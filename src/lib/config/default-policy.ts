import type { TravelPolicy, TravelConfig } from '@/lib/types/travel-config';

export const DEFAULT_POLICY: TravelPolicy = {
  domesticHotels: [
    {
      cities: ['北京', '上海', '广州', '深圳', '杭州'],
      maxPerNight: 800,
      label: '一线城市',
    },
    {
      cities: [],
      maxPerNight: 500,
      label: '其他城市',
    },
  ],
  internationalHotels: [
    {
      cities: [],
      maxPerNight: 1500,
      label: '标准',
    },
    {
      cities: [],
      maxPerNight: 2000,
      label: '旺季/一线城市',
    },
  ],
  mealAllowance: {
    domestic: 100,
    international: 200,
  },
  flightClass: 'economy',
  flightClassNote: '公务舱需提前审批',
  advanceBookingDays: 3,
  generalNotes: [
    '尽量选择性价比高的方案',
    '住宿优先选择公司协议酒店',
  ],
};

export const INITIAL_CONFIG: TravelConfig = {
  policy: DEFAULT_POLICY,
  policyOverrides: {},
  profiles: [],
  activeProfileId: null,
};
