import { Suspense } from "react";
import AlbumsBrowser from "@/components/AlbumsBrowser";

export default function AlbumsPage() {
  return (
    <Suspense>
      <AlbumsBrowser />
    </Suspense>
  );
}
