// GPS 좌표를 사람이 읽을 수 있는 짧은 장소명으로 변환 (OpenStreetMap Nominatim, 무료)
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=ko`;
    const res = await fetch(url, {
      headers: {
        // Nominatim 사용 정책상 식별 가능한 User-Agent 필요
        "User-Agent": "shared-album-app/1.0 (personal couple photo album)",
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      address?: Record<string, string>;
      display_name?: string;
    };
    const a = data.address;
    if (!a) return data.display_name?.split(",")[0]?.trim() ?? null;

    const place = a.city ?? a.town ?? a.village ?? a.county ?? a.suburb;
    const region = a.state ?? a.province;
    if (place && region && place !== region) return `${region} ${place}`;
    return place ?? region ?? data.display_name?.split(",")[0]?.trim() ?? null;
  } catch {
    return null;
  }
}
