import { marketPrices } from '@/lib/vpp/market-data';
import { recommendAtPrice } from '@/lib/vpp/market-decision';
import type { MarketSettings } from '@/lib/vpp/market-decision';
import type { DispatchCommand } from '@/lib/vpp/dispatch';

export interface PriceIntervalView {
  readonly step: number;
  readonly priceUSDPerMWh: number;
  readonly command: DispatchCommand;
}

/** Read-only price classification; the authoritative strategy chooses every command.
 * Empty assets avoid computing fleet physical previews for chart-only signals.
 * No physical result from this adapter is presented or executed.
 */
export function marketPriceViews(settings: MarketSettings): readonly PriceIntervalView[] {
  return marketPrices.map(point => ({ ...point, command: recommendAtPrice([],point.step,settings,point.priceUSDPerMWh).request.command }));
}
