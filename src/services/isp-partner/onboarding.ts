/** ONBOARD-1 endpoints (`/isp/onboarding*`). Step-2 uploads reuse
 * `complianceService.uploadDocument` (JAZE-3) unchanged. */
import api from "@/services/api";
import type {
  OnboardingBody,
  OnboardingOptions,
  OnboardingResult,
} from "@/services/isp-partner/onboarding-types";

export const onboardingService = {
  async options(): Promise<OnboardingOptions> {
    return (await api.get<OnboardingOptions>("/isp/onboarding/options")).data;
  },
  async create(body: OnboardingBody): Promise<OnboardingResult> {
    return (await api.post<OnboardingResult>("/isp/onboarding", body, { timeout: 60_000 })).data;
  },
};
