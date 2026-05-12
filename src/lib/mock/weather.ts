interface WeatherForecast {
  date: string;
  weather: string;
  temperature_high: number;
  temperature_low: number;
  wind: string;
}

const WEATHER_OPTIONS = [
  { weather: '晴', tempRange: [5, 8] as const },
  { weather: '多云', tempRange: [3, 6] as const },
  { weather: '阴', tempRange: [2, 5] as const },
  { weather: '小雨', tempRange: [2, 4] as const },
  { weather: '晴转多云', tempRange: [4, 7] as const },
];

const WIND_OPTIONS = ['东风3级', '南风2级', '西北风3-4级', '微风', '北风2级'];

/**
 * 获取天气预报
 * MVP 阶段使用 mock 数据
 */
export async function getWeather(city: string, dates: string[]) {
  const forecasts: WeatherForecast[] = dates.map((date) => {
    // 基于日期字符串生成伪随机但稳定的结果
    const seed = date.split('-').reduce((acc, v) => acc + Number(v), 0);
    const option = WEATHER_OPTIONS[seed % WEATHER_OPTIONS.length];
    const baseTemp = 15 + (seed % 15); // 15-30 度基础温度

    return {
      date,
      weather: option.weather,
      temperature_high: baseTemp + option.tempRange[1],
      temperature_low: baseTemp - option.tempRange[0],
      wind: WIND_OPTIONS[seed % WIND_OPTIONS.length],
    };
  });

  return { city, forecasts };
}
