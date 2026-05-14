import { searchNearbyHotels } from '@/lib/amap/hotel-search';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get('city');
  const keyword = searchParams.get('keyword');

  if (!city) {
    return Response.json({ error: '缺少 city 参数' }, { status: 400 });
  }

  const raw = await searchNearbyHotels(city, keyword || undefined);

  try {
    const data = JSON.parse(raw);
    return Response.json(data.hotels || []);
  } catch {
    return Response.json([]);
  }
}
