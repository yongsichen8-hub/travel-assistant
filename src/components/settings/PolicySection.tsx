'use client';

import { useTravelConfig } from '@/lib/config/travel-config-context';
import { DEFAULT_POLICY } from '@/lib/config/default-policy';
import type { TravelPolicy } from '@/lib/types/travel-config';

export function PolicySection() {
  const { config, updatePolicy, resetPolicy } = useTravelConfig();
  const overrides = config.policyOverrides;

  // 获取当前生效值（override 优先，否则用 default）
  const getValue = <K extends keyof TravelPolicy>(key: K): TravelPolicy[K] => {
    return (overrides[key] ?? DEFAULT_POLICY[key]) as TravelPolicy[K];
  };

  const domesticHotels = (overrides.domesticHotels ?? DEFAULT_POLICY.domesticHotels);
  const internationalHotels = (overrides.internationalHotels ?? DEFAULT_POLICY.internationalHotels);
  const mealAllowance = {
    domestic: overrides.mealAllowance?.domestic ?? DEFAULT_POLICY.mealAllowance.domestic,
    international: overrides.mealAllowance?.international ?? DEFAULT_POLICY.mealAllowance.international,
  };
  const flightClass = getValue('flightClass');
  const advanceBookingDays = getValue('advanceBookingDays') as number;

  const handleDomesticBudget = (index: number, value: number) => {
    const updated = [...domesticHotels];
    updated[index] = { ...updated[index], maxPerNight: value };
    updatePolicy({ domesticHotels: updated });
  };

  const handleInternationalBudget = (index: number, value: number) => {
    const updated = [...internationalHotels];
    updated[index] = { ...updated[index], maxPerNight: value };
    updatePolicy({ internationalHotels: updated });
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          差旅政策
        </h2>
        <button
          onClick={resetPolicy}
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          恢复默认
        </button>
      </div>

      {/* 国内酒店预算 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          国内酒店预算（元/晚）
        </h3>
        {domesticHotels.map((rule, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">
              {rule.label}
            </span>
            <input
              type="number"
              value={rule.maxPerNight}
              onChange={(e) => handleDomesticBudget(i, Number(e.target.value))}
              className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            />
            {rule.cities.length > 0 && (
              <span className="text-xs text-zinc-400">
                {rule.cities.join('、')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 国际酒店预算 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          国际酒店预算（元/晚）
        </h3>
        {internationalHotels.map((rule, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">
              {rule.label}
            </span>
            <input
              type="number"
              value={rule.maxPerNight}
              onChange={(e) => handleInternationalBudget(i, Number(e.target.value))}
              className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        ))}
      </div>

      {/* 餐饮补贴 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          餐饮补贴（元/天）
        </h3>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">国内</span>
          <input
            type="number"
            value={mealAllowance.domestic}
            onChange={(e) =>
              updatePolicy({
                mealAllowance: { ...mealAllowance, domestic: Number(e.target.value) },
              })
            }
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">国际</span>
          <input
            type="number"
            value={mealAllowance.international}
            onChange={(e) =>
              updatePolicy({
                mealAllowance: { ...mealAllowance, international: Number(e.target.value) },
              })
            }
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
        </div>
      </div>

      {/* 机票政策 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          机票政策
        </h3>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">舱位</span>
          <select
            value={flightClass}
            onChange={(e) =>
              updatePolicy({ flightClass: e.target.value as TravelPolicy['flightClass'] })
            }
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            <option value="economy">经济舱</option>
            <option value="business">公务舱</option>
            <option value="first">头等舱</option>
          </select>
        </div>
      </div>

      {/* 提前预订天数 */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          提前预订
        </h3>
        <div className="flex items-center gap-3">
          <span className="w-24 text-sm text-zinc-500 dark:text-zinc-400">建议提前</span>
          <input
            type="number"
            value={advanceBookingDays}
            min={0}
            onChange={(e) =>
              updatePolicy({ advanceBookingDays: Number(e.target.value) })
            }
            className="w-20 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <span className="text-sm text-zinc-500">天</span>
        </div>
      </div>
    </section>
  );
}
