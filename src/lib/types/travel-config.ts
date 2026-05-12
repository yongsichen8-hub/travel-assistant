// 差旅政策与个人偏好配置类型定义

export interface HotelBudgetRule {
  cities: string[];
  maxPerNight: number;
  label: string;
}

export interface TravelPolicy {
  domesticHotels: HotelBudgetRule[];
  internationalHotels: HotelBudgetRule[];
  mealAllowance: {
    domestic: number;
    international: number;
  };
  flightClass: 'economy' | 'business' | 'first';
  flightClassNote: string;
  advanceBookingDays: number;
  generalNotes: string[];
}

export interface HotelPreference {
  starRating: number;
  brandPreference: string[];
  locationPriority: 'convenience' | 'quiet' | 'scenic';
}

export interface TravelProfile {
  id: string;
  name: string;
  seatPreference: 'window' | 'aisle' | 'any';
  mealPreference: string;
  hotelPreference: HotelPreference;
  preferredAirlines: string[];
  budgetFlexibility: 'strict' | 'moderate' | 'flexible';
  specialNeeds: string;
  isDefault: boolean;
}

export interface TravelConfig {
  policy: TravelPolicy;
  policyOverrides: Partial<TravelPolicy>;
  profiles: TravelProfile[];
  activeProfileId: string | null;
}

export interface ResolvedTravelConfig {
  policy: TravelPolicy;
  activeProfile: TravelProfile | null;
}

/** 合并默认政策与用户覆盖，返回最终生效配置 */
export function resolveConfig(config: TravelConfig): ResolvedTravelConfig {
  const merged: TravelPolicy = {
    ...config.policy,
    ...config.policyOverrides,
    mealAllowance: {
      ...config.policy.mealAllowance,
      ...(config.policyOverrides.mealAllowance ?? {}),
    },
  };

  // 数组字段：如果 override 存在则完全替换
  if (config.policyOverrides.domesticHotels) {
    merged.domesticHotels = config.policyOverrides.domesticHotels;
  }
  if (config.policyOverrides.internationalHotels) {
    merged.internationalHotels = config.policyOverrides.internationalHotels;
  }
  if (config.policyOverrides.generalNotes) {
    merged.generalNotes = config.policyOverrides.generalNotes;
  }

  const activeProfile = config.activeProfileId
    ? config.profiles.find((p) => p.id === config.activeProfileId) ?? null
    : config.profiles.find((p) => p.isDefault) ?? null;

  return { policy: merged, activeProfile };
}
