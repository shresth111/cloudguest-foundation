/** SMALL-3: log one win-back action; never blocks or fails the action itself. */
import { useQueryClient } from "@tanstack/react-query";
import { SAVE_RATE_KEY } from "@/lib/isp-partner/winback";
import { winbackService } from "@/services/isp-partner/winback";

export function useRecordWinback() {
  const qc = useQueryClient();
  return (body: Parameters<typeof winbackService.record>[0]) => {
    winbackService
      .record(body)
      .then(() => qc.invalidateQueries({ queryKey: SAVE_RATE_KEY }))
      .catch(() => {
        // best effort: the renew / ticket / share already happened
      });
  };
}
