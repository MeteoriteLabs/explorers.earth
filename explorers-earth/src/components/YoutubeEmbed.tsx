import { memo } from "react";

const extractVideoId = (url: string) => {
  const regex =
    /(?:youtu\.be\/|youtube\.com\/(?:.*v=|embed\/|shorts\/|live\/|watch\?v=))([^&?/]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const YouTubeEmbed = memo(({ url }: { url: string }) => {
  if (!url) return null;

  // Check for Instagram URL
  if (url.includes("instagram.com")) {
    return (
      <div className="flex justify-center w-full">
        <iframe
          className="w-full max-w-md rounded-lg border border-gray-200"
          src={url}
          height="550"
          frameBorder="0"
          scrolling="no"
          allowTransparency={true}
          title="Instagram social post"
        ></iframe>
      </div>
    );
  }

  // YouTube logic
  const videoId = extractVideoId(url);

  if (!videoId) return null;

  return (
    <div className="flex justify-center w-full">
      <iframe
        className="w-full aspect-video rounded-lg"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube social url"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>
  );
});

export default YouTubeEmbed;
