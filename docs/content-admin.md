# ZeekFusion creator content

Sign in through Z Market with the ZeekFusion Kick account, then use Creator Admin in the homepage footer. The server checks the verified Kick account ID before showing the link or opening the editor. Other accounts and anonymous visitors are redirected away from the admin page; protected reads and saves independently enforce the same owner check.

## Latest video
Paste a normal YouTube watch/share/Short/live URL. Optionally edit the title, then choose **Update Video**. The saved video becomes the homepage card and watch link; its thumbnail comes from YouTube. Unavailable, private or removed videos may have a placeholder thumbnail until replaced.

## Travel Map
Choose World or USA, choose a country/state, select Visited or Upcoming, optionally add a city/stop name, note, destination link and up to 20 individually titled stream/VOD/video links, then save. Multiple stops can belong to the same country/state; the visited counter counts distinct countries/states. Use Add another video to add links; each video has its own title, URL and remove button. Save location applies the complete list. Existing single video links are preserved when editing. The destination list supports search, editing and removal. Public pages load saved content on entry and refresh periodically, so an already-open page can take up to one minute to refresh.

## Live hero
The reusable HeroMedia component switches between the existing portrait and Kick's official embedded player. Stream status comes from a server-side Kick channel query with a short cached observation, a refresh lock and a 30-second client poll. The player starts muted; browser/provider autoplay rules still apply. Unknown/stale status is identified separately from offline. A future next-stream field can be supplied to the same component.

The player uses [Kick's official embedding interface](https://help.kick.com/en/articles/8010826-how-to-embed-your-kick-livestream). Twitch and YouTube remain direct links, without live detection.

## Security and compatibility
Migration 019 adds owner-only writes and a revision check so stale windows cannot overwrite a newer save. RLS and revoked anonymous/authenticated grants prevent direct access. The API validates URLs and location choices, limits input size and request frequency, checks owner identity and same origin, and returns only public content on public reads. No tokens or provider credentials are sent to the browser.

The old #/vault route redirects to #/market to preserve existing links. Existing encryption salts, database names and game identifiers remain stable; user-facing branding is Z Market. The Arcade mode switches and circular background styling were not changed.

## Release validation
41 application tests and eight isolated database test groups pass. The production build passes. Responsive checks cover 390×844, 768×1024, 1366×768, 1440×900, 1920×1080, 2560×1440 and 3440×1440. The editor save flow was tested using disposable local content, including homepage video updates and map counts. Live and offline layouts were exercised with local status fixtures; real stream playback depends on the channel actually being live and Kick allowing playback in the visitor's browser. No production balance or wager was modified.
