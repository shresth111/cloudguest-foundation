-- ===========================================================================
-- Incident 2026-09-06: "OTP entered, page went white, no internet"
-- Read-only triage queries. NOTHING HERE WRITES. Run on the cloudguest DB.
--
-- Schema verified against the backend commit that introduced whitelist-only
-- (alembic 0117_add_whitelist_only_to_captive_portal_configs), not guessed.
--
-- Scope: the fleet has exactly ONE real MikroTik, so there is one real
-- venue. Q0 resolves it; every later query keys off that result.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Q0. Which location is the one real router at?
--
-- "Real" = has stored API credentials. The nine fixtures do not (three are on
-- 192.0.2.0/24, which is TEST-NET-1, i.e. documentation addresses).
-- Everything below needs the location_id this returns.
-- ---------------------------------------------------------------------------
SELECT r.id            AS router_id,
       r.name,
       r.location_id,
       r.organization_id,
       r.management_ip_address,
       r.status,
       r.last_seen_at,
       (r.api_credentials_encrypted IS NOT NULL) AS has_credentials
FROM routers r
ORDER BY has_credentials DESC, r.last_seen_at DESC NULLS LAST;


-- ---------------------------------------------------------------------------
-- Q1. THE KILLER QUESTION. Is whitelist-only on, and when was it touched?
--
-- Returns both the location-specific override AND the org-level default the
-- location inherits from (location_id IS NULL), because config resolution is
-- most-specific-wins.
--
-- Substitute :location_id / :organization_id from Q0.
--
-- HOW TO READ IT:
--   * No row with whitelist_only_enabled = true  -> the three-minute-window
--     hypothesis is DEAD. Say so and stop; the guest was not refused.
--   * A location row with it true                -> the venue is in
--     whitelist-only mode. Compare updated_at against 16:03:42-16:06:54 UTC.
--   * The ORG-DEFAULT row (location_id IS NULL) with it true -> a bug in its
--     own right: #159's validate_whitelist_only_scope forbids the flag on an
--     org default. That would mean it was set by something that bypassed the
--     validator, and it would apply to EVERY location under the org.
--
-- NOTE: updated_at is last-write-wins for the whole row, so it dates the most
-- recent edit to ANY column, not necessarily to this flag. Treat it as an
-- upper bound on when the flag was set, not proof of the moment.
-- ---------------------------------------------------------------------------
SELECT c.id,
       c.location_id,
       c.organization_id,
       c.is_default,
       c.whitelist_only_enabled,
       c.whitelist_only_denied_message,
       c.created_at,
       c.updated_at
FROM captive_portal_configs c
WHERE c.location_id = :location_id
   OR (c.organization_id = :organization_id AND c.location_id IS NULL)
ORDER BY c.location_id NULLS LAST;


-- Q1b. Fleet-wide version of the same question, in case the flag was set on a
-- location other than the one real router's. One row per config that has it
-- on; an empty result kills the hypothesis outright and completely.
SELECT c.id, c.organization_id, c.location_id, c.is_default, c.updated_at
FROM captive_portal_configs c
WHERE c.whitelist_only_enabled IS TRUE
ORDER BY c.updated_at DESC;


-- ---------------------------------------------------------------------------
-- Q2. Was a real guest actually turned away, and when?
--
-- failure_reason is exactly WhitelistOnlyAccessDeniedError -- the backend
-- spells it out as WHITELIST_ONLY_LOGIN_FAILURE_REASON in
-- app/domains/guest/constants.py precisely so this query does not have to
-- import an exception class to build the filter.
--
-- HOW TO READ IT:
--   * A row near 16:03-16:07 UTC  -> hypothesis CONFIRMED. The guest was
--     refused, not broken: "no internet" is the feature working. Note the
--     frontend caveat below, though -- it changes what they saw.
--   * Rows at other times         -> whitelist-only is live and turning real
--     guests away right now, which is its own live issue.
--   * No rows at all              -> nobody has ever been refused by it.
-- ---------------------------------------------------------------------------
SELECT h.attempted_at,
       h.identifier,
       h.auth_method,
       h.success,
       h.failure_reason,
       h.ip_address,
       h.location_id
FROM guest_login_history h
WHERE h.failure_reason = 'WhitelistOnlyAccessDeniedError'
ORDER BY h.attempted_at DESC
LIMIT 100;


-- Q2b. Everything that happened at that location today, refusal or not.
-- Widest net: if the guest's attempt is not in Q2, it is in here, and its
-- failure_reason (an exception class name) says what actually stopped them.
SELECT h.attempted_at,
       h.identifier,
       h.auth_method,
       h.success,
       h.failure_reason,
       h.ip_address
FROM guest_login_history h
WHERE h.location_id = :location_id
  AND h.attempted_at >= TIMESTAMP '2026-09-06 00:00:00'
ORDER BY h.attempted_at DESC
LIMIT 200;


-- ---------------------------------------------------------------------------
-- Q2c. Does the Always Allowed list have anything on it?
--
-- Only meaningful if Q1 says the flag is on. An EMPTY whitelist with the flag
-- on refuses EVERY guest at that venue -- which is the worst case and the
-- easiest mistake to make from a freshly-shipped toggle.
-- ---------------------------------------------------------------------------
SELECT g.rule_type,
       count(*) FILTER (WHERE g.is_active)                          AS active_rules,
       count(*) FILTER (WHERE g.is_active
                          AND (g.expires_at IS NULL
                               OR g.expires_at > now()))            AS active_unexpired
FROM guest_access_rules g
WHERE g.organization_id = :organization_id
  AND (g.location_id = :location_id OR g.location_id IS NULL)
GROUP BY g.rule_type
ORDER BY g.rule_type;


-- ---------------------------------------------------------------------------
-- Q3. "Online behind a broken screen" vs "genuinely offline".
--
-- THE hs-auth 0 BYTES TELL, in SQL. FreeRADIUS on this stack does NOT write
-- accounting to a SQL table -- it writes detail files to
-- /var/log/freeradius/radacct/<nas-ip>/detail-<date> (see
-- ops/freeradius/README.md). So there is no radacct table to join against.
-- The SQL-expressible proxy is guest_sessions' own byte counters, which are
-- only ever advanced by RADIUS interim-update accounting.
--
-- HOW TO READ IT:
--   * total_bytes = 0 AND last_activity_at = started_at
--       -> the platform created a session but NO accounting ever arrived:
--          the NAS gate never opened. The guest was GENUINELY OFFLINE, and
--          the fault is on the POST-to-NAS / RADIUS side, not the UI.
--   * total_bytes > 0
--       -> the gate DID open. The guest was ONLINE and the white screen was
--          a UI failure in front of working internet -- which is exactly the
--          case PR #233's error boundary is for.
--
-- Cross-check on the box itself (not SQL):
--   ls -la /var/log/freeradius/radacct/<router-ip>/
--   grep -c "Accounting-Request" /var/log/freeradius/radacct/<router-ip>/detail-20260906
-- ---------------------------------------------------------------------------
SELECT s.started_at,
       s.ended_at,
       s.status,
       s.auth_method,
       g.identifier,
       s.ip_address,
       s.bytes_uploaded,
       s.bytes_downloaded,
       (s.bytes_uploaded + s.bytes_downloaded) AS total_bytes,
       s.last_activity_at,
       (s.last_activity_at = s.started_at)     AS never_had_accounting
FROM guest_sessions s
JOIN guests g ON g.id = s.guest_id
WHERE s.location_id = :location_id
  AND s.started_at >= TIMESTAMP '2026-09-06 00:00:00'
ORDER BY s.started_at DESC
LIMIT 100;


-- Q3b. The summary line: how many of today's sessions never saw a byte.
-- A high never_accounted count is the fleet-level version of the same tell,
-- and it is the number that says whether this is one guest or every guest.
SELECT count(*)                                                       AS sessions_today,
       count(*) FILTER (WHERE s.bytes_uploaded + s.bytes_downloaded = 0)
                                                                      AS never_accounted,
       min(s.started_at)                                              AS first_session,
       max(s.started_at)                                              AS last_session
FROM guest_sessions s
WHERE s.location_id = :location_id
  AND s.started_at >= TIMESTAMP '2026-09-06 00:00:00';
