# Clips account connections

The gallery reads `z_clips` through `/api/clips`; no hand-maintained video list is imported. Popular means strictly more than 10,000 views, highest first. Unknown view counts appear only in Latest. All provider pages are followed. Deleted/private videos are removed after a complete successful catalog pass; an interrupted pass retains its cursor and existing cache.

TikTok and Instagram currently use owner-supplied links and count snapshots (migration 017), by request. They do not require developer accounts. Existing videos remain available. Missing thumbnails use a branded fallback; playback opens the official embed or original link. YouTube automatic syncing still requires completed OAuth setup.

## Installation

Apply migrations 013 (Blackjack), 014 (Clips), 015 (Clips scheduler), and 016 (preserve the existing cache) in order in the existing Supabase project. 015 uses the already-installed pg_cron and pg_net extensions. Publish the application after the migrations. No new Vercel secrets are needed: existing server-only Supabase credentials and the existing encryption key protect app credentials and refresh tokens.

## Owner connection flow

Sign in with the owner Kick account and open Vault → Controls → Clips Connections. Each provider has its exact callback URL, required permissions, and a link to its developer portal. Create the provider application, enter its client ID/key and client secret in the private form, save, then Connect. Never paste credentials into chat, source code, or browser-visible environment variables.

- **YouTube:** Enable YouTube Data API v3 and YouTube Analytics API in a Google Cloud project. Configure the OAuth consent screen and a Web application client. Grant only `youtube.readonly` and `yt-analytics.readonly`. Add the owner account as a test user when testing. Google testing-mode refresh-token lifetimes may require reconnection; use an appropriate production app configuration for unattended refresh.
- **TikTok:** Configure Login Kit and Display API for a website. Request `user.info.basic` and `video.list`. Register the exact redirect URL. Sandbox access only works for authorized test accounts; production use may require TikTok app review.
- **Instagram:** Use Instagram API with Instagram Login. The account must be professional (Creator/Business). Request `instagram_business_basic` and `instagram_business_manage_insights`. Register the exact redirect URL and add/accept the owner’s tester role when using standard/testing access. Review may be required for broader access.

After approval, return to Controls and choose Sync videos. The initial sync follows every page, and the scheduler subsequently advances due catalogs every five minutes. A completed catalog becomes due again six hours later. Multi-page passes can span several scheduler runs. Errors are shown only to the owner; a failed page does not mark an incomplete catalog as complete.

## Source and accuracy limits

YouTube Shorts are identified using the official Analytics `creatorContentType=SHORTS` classification for each page of channel uploads, then public Data API counts are fetched. Newly uploaded Shorts with no analytics classification yet are picked up by a later pass; duration alone is not used to misclassify ordinary videos. TikTok provides `view_count`; Instagram Reel `views` comes from media insights. Counts reflect each platform’s own definition and availability. Only public videos the connected account/API makes available can be displayed.

Live OAuth grants and real account catalogs must be verified after connection. Mocked API tests prove pagination/filter behavior, not app-review approval or live provider access.

## References

- [TikTok List Videos](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list)
- [TikTok token management](https://developers.tiktok.com/docs/en/login-kit-manage-user-access-tokens)
- [YouTube channel reports](https://developers.google.com/youtube/analytics/channel_reports)
- [YouTube video resources](https://developers.google.com/youtube/v3/docs/videos)
- [Instagram Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/)
- [Instagram insights](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights/)
