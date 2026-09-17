# Third-party notices

Moblin reference: https://github.com/eerimoq/moblin at acd6fa4df534c770a2abbe89476dccfcf5e0e836 (inspected 2026-09-17).
Copyright (c) 2023 Erik Moqvist. MIT license reproduced in MOBLIN-LICENSE.

The web implementation adapts rendering dimensions/order, Kick badge/emote normalization, third-party emote endpoints, and YouTube web-chat handling from these Moblin files:
- Moblin/View/Utils/ChatLineStyle.swift
- Moblin/View/Stream/Overlay/StreamOverlayChatView.swift
- Moblin/StreamingPlatforms/Kick/KickPusher.swift
- Moblin/StreamingPlatforms/Twitch/TwitchChat.swift
- Moblin/StreamingPlatforms/YouTube/YouTubeLiveChat.swift
- Moblin/Integrations/Emotes/{Bttv,Ffz,Seventv}.swift

Platform logo PNGs are copied from Moblin/Assets.xcassets. Platform trademarks remain owned by their respective owners. Native badges/emotes remain on their upstream CDNs. Kick static role badge URLs use the same id3adeye/kickicons paths as Moblin; no claim of ownership is made.

stream_list.proto is Google’s sample from https://developers.google.com/youtube/v3/live/streaming-live-chat (retrieved 2026-09-17). Code samples licensed Apache 2.0; full text in APACHE-2.0.txt. Modification: added the missing google/protobuf/duration.proto import so the published sample compiles. Google protocol fields and numbers are preserved.
