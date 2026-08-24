import { redirect } from "next/navigation";

// Chat and Polls used to live as tabs on this page; they're now their own
// standalone routes (/chat, /polls). This redirect exists only so any
// existing links or bookmarks to /community still land somewhere useful.
export default function CommunityPage() {
  redirect("/chat");
}
