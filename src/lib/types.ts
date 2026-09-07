export type MediaItem = {
  id: string;
  type: "photo" | "video";
  contentType: string;
  fileName: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  takenAt: number;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: number;
  ownerId: string;
  ownerName: string;
  tags: string[];
};

export type CalendarEvent = {
  id: string;
  title: string;
  eventDate: number;
  kind: "anniversary" | "event";
  repeatYearly: number;
  memo: string | null;
  createdAt: number;
};
