// Jenkins equivalent of .github/workflows/ci.yml
//
// READ THIS BEFORE ADOPTING IT
// ----------------------------
// The recommendation is GitHub Actions, and the workflow in
// .github/workflows/ci.yml is the one meant to run. This file exists so
// that "use Jenkins" is a real, working option rather than a thing that
// still needs building -- it is complete and runnable, and it enforces
// exactly the same gates.
//
// It is inert until a Jenkins controller is configured to scan this repo,
// so having both files committed does not double-run anything.
//
// WHAT THIS FILE DOES NOT INCLUDE, BECAUSE IT CANNOT
// --------------------------------------------------
// A Jenkinsfile is only the last mile. Standing this up also needs, none
// of which lives in this repo:
//
//   * A controller to run it. Under the current Azure quota that is the
//     blocker -- Total Regional vCPUs is capped at 4 against the 6 the
//     three production VMs already need, and that raise has not been
//     filed yet. A Jenkins VM makes it 8.
//   * An inbound path for GitHub webhooks (or polling, which is worse).
//     Inbound 8080/443 into the estate is exactly the NSG surface this
//     design was trying not to add.
//   * Plugin management: git, workflow-aggregator, docker-workflow,
//     credentials-binding, and their transitive upgrades, forever.
//   * A credential store, which immediately becomes the highest-value
//     target in the estate.
//
// CREDENTIALS
// -----------
// Nothing secret is written in this file and nothing secret should ever
// be. Anything sensitive comes from the Jenkins credential store via
// withCredentials(), which masks it in logs. No CI stage below needs a
// secret at all -- that is a property worth keeping.

pipeline {
  // A docker agent keeps bun/node/chromium off the controller itself, so
  // the controller stays a scheduler rather than a build box with a
  // steadily growing pile of runtimes on it.
  agent {
    docker {
      // Matches the Playwright version in package.json (^1.61.1) so the
      // bundled browser and the client library agree. A mismatch here
      // shows up as a confusing launch failure in the sign-in test.
      image 'mcr.microsoft.com/playwright:v1.61.1-jammy'
      args '-u root:root'
    }
  }

  options {
    timestamps()
    disableConcurrentBuilds(abortPrevious: true)
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  environment {
    BUN_INSTALL = "${WORKSPACE}/.bun"
    PATH = "${WORKSPACE}/.bun/bin:${PATH}"
    NODE_ENV = 'production'
    NITRO_PRESET = 'node-server'
    VITE_API_BASE_URL = '/api/v1'
  }

  stages {
    stage('Install') {
      steps {
        // Pinned to match local dev. The Dockerfile floats `npm i -g bun`,
        // which is its own reproducibility hole -- worth closing there too.
        sh '''
          set -eu
          curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"
          bun --version
          bun install --frozen-lockfile
        '''
      }
    }

    stage('Types and lint') {
      // Both are cheap and independent, and seeing BOTH results from one
      // run beats fixing a type error only to discover a lint error next.
      parallel {
        stage('tsc --noEmit') {
          steps { sh 'bunx tsc --noEmit' }
        }
        stage('eslint') {
          // --max-warnings pins the warning count as a ratchet. The repo
          // was just cleaned to 0 errors / 56 warnings.
          steps { sh 'bunx eslint . --max-warnings 56' }
        }
      }
    }

    stage('Production build') {
      steps {
        sh '''
          set -eu
          bun run build
          test -f .output/server/index.mjs \
            || { echo "no .output/server/index.mjs -- wrong nitro preset?"; exit 1; }
        '''
      }
    }

    stage('Portal regression suites') {
      steps {
        // Every suite goes through the same gate the Actions workflow
        // uses: exit 0, plus the suite's own success sentinel, plus a
        // floor on how many checks actually ran. See
        // scripts/ci-gated-test.sh for why exit status alone is not
        // enough. Floors are the counts observed green on 2026-08-22.
        sh '''
          set -eu
          bunx playwright install chromium

          ./scripts/ci-gated-test.sh \
            "portal-cna-storage-safety" 7 "all checks passed" \
            bun run test:portal-cna

          ./scripts/ci-gated-test.sh \
            "portal-signin-fields" 23 \
            "Sign-in field regression test: all checks passed." \
            bun run test:signin-fields

          ./scripts/ci-gated-test.sh \
            "fw-rule-order" 7 "fw-rule-order: all checks passed" \
            bun run test:fw-order

          ./scripts/ci-gated-test.sh \
            "a11y-invariants" 0 \
            "Portal accessibility invariants: all checks passed." \
            bun run test:a11y

          ./scripts/ci-gated-test.sh \
            "manual-wizard-engine" 100 \
            "manual-wizard-engine: all checks passed" \
            bun run test:manual-wizard

          ./scripts/ci-gated-test.sh \
            "post-login-html-roundtrip" 21 \
            "All post-login HTML round-trip checks passed." \
            bun run test:post-login-roundtrip

          ./scripts/ci-gated-test.sh \
            "post-login-html-sandbox" 9 \
            "All post-login HTML sandbox checks passed." \
            bun run test:post-login-sandbox
        '''
      }
    }
  }

  post {
    always {
      // Jenkins does not clean workspaces by default, and a stale
      // .output/ or node_modules is a classic source of a build that
      // passes on the box and fails everywhere else.
      cleanWs()
    }
  }
}
