/**
 * `/partner/settings/integrations` (APPS-2 #5): one card per external
 * integration, showing only what `GET /isp/integrations/status` records --
 * configured yes/no, last success / failure where the backend logs one -- and
 * a link to the existing screen that configures it. Nothing here edits.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { MSectionHeader, MTag } from "@/components/master/MasterKit";
import { Card, ErrorBlock, LoadingBlock } from "@/components/isp-partner/kit";
import { usePartner } from "@/components/isp-partner/PartnerContext";
import { ispKeys } from "@/hooks/isp-partner/keys";
import { retryUnless4xx } from "@/hooks/isp-partner/useIsp";
import { formatDateTime, formatNumber } from "@/lib/isp-partner/format";
import {
  INTEGRATION_LINKS,
  INTEGRATION_TITLES,
  lastOutcome,
  stateLabel,
  yesNo,
  type IntegrationKey,
} from "@/lib/isp-partner/integrations";
import { integrationsService, type IntegrationState } from "@/services/isp-partner/integrations";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Outcome({ sent, failed }: { sent: string | null; failed: string | null }) {
  const last = lastOutcome(sent, failed);
  return (
    <>
      <Row label="Last sent">{formatDateTime(sent)}</Row>
      <Row label="Last failed">
        <span className={last?.kind === "failed" ? "text-destructive" : undefined}>
          {formatDateTime(failed)}
        </span>
      </Row>
      {!last && (
        <p className="col-span-2 text-[11px] text-muted-foreground">No sends recorded yet.</p>
      )}
    </>
  );
}

function IntegrationCard({
  k,
  state,
  children,
}: {
  k: IntegrationKey;
  state: IntegrationState;
  children?: ReactNode;
}) {
  const { can } = usePartner();
  const tag = stateLabel(state);
  const link = INTEGRATION_LINKS[k];
  return (
    <Card
      title={INTEGRATION_TITLES[k]}
      actions={
        <>
          <MTag label={tag.label} tone={tag.tone} />
          {link && can(link.perm) && (
            <Link
              to={link.to}
              search={link.search}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open settings
            </Link>
          )}
        </>
      }
    >
      {children && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">{children}</dl>
      )}
    </Card>
  );
}

export function IntegrationsPage() {
  const { can } = usePartner();
  const q = useQuery({
    queryKey: ispKeys.integrationsStatus,
    queryFn: () => integrationsService.getStatus(),
    retry: retryUnless4xx,
    enabled: can("isp_partner.read"),
  });
  const back = (
    <Link
      to="/partner/settings"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Settings
    </Link>
  );
  if (!can("isp_partner.read")) {
    return (
      <>
        <MSectionHeader eyebrow="Settings" title="Integrations" actions={back} />
        <Card>
          <p className="text-sm text-muted-foreground">Your role cannot view integration status.</p>
        </Card>
      </>
    );
  }
  return (
    <>
      <MSectionHeader
        eyebrow="Settings"
        title="Integrations"
        description="What is set up, and the last recorded result. Configure each one on its own screen."
        actions={back}
      />
      {q.isLoading ? (
        <LoadingBlock />
      ) : q.error || !q.data ? (
        <ErrorBlock error={q.error} onRetry={() => q.refetch()} what="integration status" />
      ) : (
        <Cards data={q.data.cards} />
      )}
    </>
  );
}

function Cards({
  data,
}: {
  data: import("@/services/isp-partner/integrations").IntegrationsStatus["cards"];
}) {
  const { whatsapp: wa, email, telegram: tg, acs, ipdr_archive: ipdr } = data;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <IntegrationCard k="whatsapp" state={wa.state}>
        <Row label="Sender set up">{yesNo(wa.configured)}</Row>
        {wa.configured && (
          <>
            <Row label="Sender status">{wa.status ?? "–"}</Row>
            <Row label="Last verified">{formatDateTime(wa.last_verified_at)}</Row>
            {wa.last_error && (
              <Row label="Last error">
                <span className="text-destructive">{wa.last_error}</span>
              </Row>
            )}
          </>
        )}
        <Row label="Billing automation">
          {wa.automation_feature_enabled
            ? wa.automation_enabled
              ? "On"
              : "Off"
            : "Not available on this platform"}
        </Row>
        <Outcome sent={wa.last_sent_at} failed={wa.last_failed_at} />
      </IntegrationCard>

      <IntegrationCard k="email" state={email.state}>
        <Row label="Sender set up">{yesNo(email.configured)}</Row>
        {email.configured && (
          <>
            <Row label="Sender status">{email.status ?? "–"}</Row>
            <Row label="Last verified">{formatDateTime(email.last_verified_at)}</Row>
            {email.last_error && (
              <Row label="Last error">
                <span className="text-destructive">{email.last_error}</span>
              </Row>
            )}
          </>
        )}
      </IntegrationCard>

      <IntegrationCard k="telegram" state={tg.state}>
        <Row label="Bot token set">{yesNo(tg.bot_token_set)}</Row>
        <Row label="Chat set">{yesNo(tg.chat_id_set)}</Row>
        <Row label="Alerts">
          {tg.feature_enabled ? (tg.enabled ? "On" : "Off") : "Not available on this platform"}
        </Row>
        <Outcome sent={tg.last_sent_at} failed={tg.last_failed_at} />
      </IntegrationCard>

      <IntegrationCard k="acs" state={acs.state}>
        <Row label="TR-069 on this platform">{yesNo(acs.feature_enabled)}</Row>
        <Row label="ACS credentials">
          {formatNumber(acs.enabled_credentials)} enabled of {formatNumber(acs.credentials)}
        </Row>
        <Row label="Devices">{formatNumber(acs.devices)}</Row>
        <Row label="Last check-in">{formatDateTime(acs.last_inform_at)}</Row>
      </IntegrationCard>

      <IntegrationCard k="payment_gateway" state="coming_soon">
        <p className="col-span-2 text-sm text-muted-foreground">
          Collecting payments through a gateway is not available yet.
        </p>
      </IntegrationCard>

      <IntegrationCard k="ipdr_archive" state={ipdr.state}>
        <Row label="IPDR day files">
          {ipdr.store === "s3" ? "Off-site archive" : "Stored on the app server only"}
        </Row>
        <Row label="Last built">{formatDateTime(ipdr.last_built_at)}</Row>
        {ipdr.store === "s3" && (
          <Row label="Last off-site copy">{formatDateTime(ipdr.last_offsite_built_at)}</Row>
        )}
        <Row label="NAT / IPDR exports">Not set up</Row>
      </IntegrationCard>
    </div>
  );
}
