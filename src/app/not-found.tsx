import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1226] px-6 py-14 text-center">
      <Compass className="h-6 w-6 text-mist-500" />
      <p className="text-sm font-medium text-mist-100">That page does not exist</p>
      <p className="max-w-sm text-xs leading-relaxed text-mist-400">
        The link may be out of date. The executive overview is the best place to start.
      </p>
      <Link
        href="/"
        className="mt-1 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-[0.8125rem] text-mist-100 transition-colors hover:border-white/25 hover:bg-white/8"
      >
        Executive Overview
      </Link>
    </div>
  );
}
