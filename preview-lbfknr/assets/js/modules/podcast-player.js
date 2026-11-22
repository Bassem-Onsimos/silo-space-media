import { findAll, findOne } from './dom.js';
import { revealAddedItems } from './scroll-reveal.js';

/*
 * Podcast page: the big YouTube player and the list of every episode.
 *
 * The episode ids come from the YouTube player itself (it loads the playlist), and their titles from
 * YouTube's public oEmbed endpoint: no API key, and nothing is downloaded, episodes stream from YouTube.
 * The last list seen is kept in the browser so a return visit shows it instantly, and the page also
 * carries a copy of the list (fallbackEpisodes) for browsers that won't hand the playlist over.
 */
const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 3.5v17l14-8.5z"/></svg>';
const LEVEL_METER = '<span class="meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
const EXTERNAL_LINK_ICON =
  '<svg class="external-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9L9 3M4.2 3H9v4.8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLAYLIST_POLL_ATTEMPTS = 60;
const PLAYLIST_POLL_INTERVAL_MS = 250;
const GIVE_UP_AFTER_MS = 15000;

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]),
  );
const thumbnailUrl = (videoId, quality = 'hqdefault') => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
const watchUrl = (videoId, playlistId) => `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`;
const playlistUrl = (playlistId) => `https://www.youtube.com/playlist?list=${playlistId}`;

/* ---------- reading episode titles ---------- */

/* "Ep. 7 Title | Show FULL EPISODE" -> { title: 'Title', season: null, episode: 7 } */
export function parseEpisodeTitle(rawTitle, showName) {
  let title = String(rawTitle).replace(/\s+/g, ' ').trim();
  let season = null;
  let episode = null;
  let match;
  if ((match = title.match(/\bS(?:eason)?\s*0*(\d+)\s*[,/·|-]?\s*E(?:p(?:isode)?)?\.?\s*:?\s*0*(\d+)/i))) {
    season = Number(match[1]);
    episode = Number(match[2]);
    title = title.replace(match[0], ' ');
  } else if ((match = title.match(/\bEp(?:isode)?\.?\s*:?\s*0*(\d+)\b/i))) {
    episode = Number(match[1]);
    title = title.replace(match[0], ' ');
  }
  title = title.replace(/\(?\s*full episode\s*\)?/gi, ' ');
  title = title
    .split(/\s+\|\s+/)
    .filter((part, index) => index === 0 || !part.toLowerCase().includes(String(showName).toLowerCase()))
    .join(': ');
  title = title
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:|·–-]+|[\s:|·–-]+$/g, '')
    .trim();
  return { title: title || rawTitle, season, episode };
}

/* Newest first when every title has an episode number; grouped by season when there is more than one. */
function sortNewestFirst(episodes) {
  if (episodes.length && episodes.every((item) => item.episode != null)) {
    const anySeason = episodes.some((item) => item.season != null);
    episodes.forEach((item) => {
      if (item.season == null) item.season = anySeason ? 1 : null;
    });
    episodes.sort((first, second) => (second.season || 0) - (first.season || 0) || second.episode - first.episode);
  }
  return episodes;
}

const shortEpisodeLabel = (item) =>
  item.episode == null ? 'Episode' : item.season != null ? `S${item.season} · E${item.episode}` : `Ep ${item.episode}`;
const fullEpisodeLabel = (item) =>
  item.episode == null
    ? ''
    : item.season != null
    ? `Season ${item.season} · Episode ${item.episode}`
    : `Episode ${item.episode}`;

function fetchTitles(videoIds) {
  return Promise.all(
    videoIds.map((videoId) =>
      fetch(
        `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${videoId}`,
        )}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .then((json) => (json && json.title ? { id: videoId, rawTitle: json.title } : null))
        .catch(() => null),
    ),
  ).then((results) => results.filter(Boolean));
}

/* ---------- remembering the last list ---------- */

const storageKey = (playlistId) => `podcast-episodes:${playlistId}`;

function readSavedEpisodes(playlistId) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(playlistId)) || 'null');
    return saved && Array.isArray(saved.episodes) ? saved.episodes : null;
  } catch (error) {
    return null;
  }
}

function saveEpisodes(playlistId, episodes) {
  try {
    localStorage.setItem(storageKey(playlistId), JSON.stringify({ savedAt: Date.now(), episodes }));
  } catch (error) {
    /* storage full or blocked */
  }
}

/* ---------- the YouTube player ---------- */

let youtubeApiLoading = null;
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (youtubeApiLoading) return youtubeApiLoading;
  youtubeApiLoading = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (previousCallback) previousCallback();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      youtubeApiLoading = null;
      reject(new Error('The YouTube player could not load'));
    };
    document.head.appendChild(script);
  });
  return youtubeApiLoading;
}

/* ---------- the page ---------- */

export function setUpPodcastPlayer() {
  const dataElement = findOne('#podcast-data');
  if (!dataElement) return;
  const show = JSON.parse(dataElement.textContent);
  const stage = findOne('#stage');
  const poster = findOne('#episode-poster');
  const posterImage = findOne('img', poster);
  const episodeList = findOne('#episode-list');
  const episodeCount = findOne('#episode-count');
  const nowPlayingLabel = findOne('#now-playing-label');
  const nowPlayingTitle = findOne('#now-playing-title');
  const nowPlayingYouTubeLink = findOne('#now-playing-youtube-link');
  const newerButton = findOne('#newer-episode');
  const olderButton = findOne('#older-episode');

  let player = null;
  let episodes = [];
  let currentIndex = -1;
  let playerReady = false;
  let waitingToPlay = null;
  let renderedSignature = '';

  /* Shows the episode's largest thumbnail, falling back to the standard one when YouTube has no large one. */
  const showPoster = (videoId) => {
    posterImage.classList.remove('is-active');
    delete posterImage.dataset.fallback;
    posterImage.onload = () => {
      if (posterImage.naturalWidth <= 120 && !posterImage.dataset.fallback) {
        posterImage.dataset.fallback = '1';
        posterImage.src = thumbnailUrl(videoId);
        return;
      }
      posterImage.classList.add('is-active');
    };
    posterImage.onerror = () => {
      if (!posterImage.dataset.fallback) {
        posterImage.dataset.fallback = '1';
        posterImage.src = thumbnailUrl(videoId);
      }
    };
    posterImage.src = thumbnailUrl(videoId, 'maxresdefault');
  };

  const showEpisodeDetails = (index) => {
    if (index < 0 || index >= episodes.length) return;
    currentIndex = index;
    const item = episodes[index];
    nowPlayingLabel.textContent =
      index === 0
        ? fullEpisodeLabel(item)
          ? `Latest · ${fullEpisodeLabel(item)}`
          : 'Latest episode'
        : fullEpisodeLabel(item) || `Episode ${episodes.length - index}`;
    nowPlayingTitle.textContent = item.title;
    nowPlayingYouTubeLink.href = watchUrl(item.id, show.playlistId);
    newerButton.disabled = index <= 0;
    olderButton.disabled = index >= episodes.length - 1;
    findAll('.episode', episodeList).forEach((card) =>
      card.classList.toggle('is-active', card.dataset.episodeId === item.id),
    );
  };

  const playEpisode = (index, scrollToPlayer) => {
    if (index < 0 || index >= episodes.length) return;
    showEpisodeDetails(index);
    if (scrollToPlayer)
      window.scrollTo({
        top: stage.getBoundingClientRect().top + scrollY - (innerWidth <= 700 ? 78 : 98),
        behavior: 'smooth',
      });
    if (playerReady && player && player.loadVideoById) {
      player.loadVideoById(episodes[index].id);
      stage.classList.add('is-playing');
    } else {
      waitingToPlay = index;
      showPoster(episodes[index].id);
    }
  };

  const renderEpisodeList = (list) => {
    const signature = list.map((item) => item.id + item.title).join('|');
    if (signature === renderedSignature) return;
    renderedSignature = signature;
    episodes = list;
    episodeCount.textContent = list.length ? `${list.length} episode${list.length > 1 ? 's' : ''}` : '—';
    const seasons = new Set(list.map((item) => item.season));
    const groupBySeason = seasons.size > 1 && !seasons.has(null);
    let lastSeason = null;
    let html = '';
    list.forEach((item, index) => {
      if (groupBySeason && item.season !== lastSeason) {
        lastSeason = item.season;
        html += `<div class="episode-season label muted">Season ${item.season}</div>`;
      }
      const longLabel =
        index === 0
          ? fullEpisodeLabel(item)
            ? `Latest · ${fullEpisodeLabel(item)}`
            : 'Latest'
          : fullEpisodeLabel(item) || 'Episode';
      const shortLabel = (index === 0 ? 'Latest · ' : '') + shortEpisodeLabel(item);
      html += `<a class="episode" href="${escapeHtml(
        watchUrl(item.id, show.playlistId),
      )}" data-episode-id="${escapeHtml(item.id)}" target="_blank" rel="noopener">
        <div class="episode-thumbnail"><img src="${thumbnailUrl(
          item.id,
        )}" alt="" loading="lazy" decoding="async"><span class="episode-play-icon" aria-hidden="true">${PLAY_ICON}</span><span class="episode-now-playing label">${LEVEL_METER}Now playing</span></div>
        <div class="episode-details"><span class="label muted"><span class="label-long">${escapeHtml(
          longLabel,
        )}</span><span class="label-short">${escapeHtml(shortLabel)}</span></span><h3>${escapeHtml(
        item.title,
      )}</h3></div></a>`;
    });
    episodeList.innerHTML = html;
    revealAddedItems(findAll('.episode', episodeList));
    if (currentIndex < 0 || currentIndex >= list.length) {
      showEpisodeDetails(0);
      if (!stage.classList.contains('is-playing')) showPoster(list[0].id);
    } else {
      showEpisodeDetails(currentIndex);
    }
  };

  /* When the live list can't be read: show the copy carried by the page, or a link to YouTube. */
  const useFallbackList = () => {
    if (episodes.length) return;
    if (show.fallbackEpisodes && show.fallbackEpisodes.length) {
      renderEpisodeList(show.fallbackEpisodes);
      if (player && player.loadVideoById) playerReady = true;
      return;
    }
    episodeList.innerHTML = `<div class="episodes-note"><p>The episode list couldn't load right now.</p><a class="btn btn-line" href="${playlistUrl(
      show.playlistId,
    )}" target="_blank" rel="noopener">Watch the episodes on YouTube${EXTERNAL_LINK_ICON}</a></div>`;
    episodeCount.textContent = '—';
    poster.onclick = () => window.open(playlistUrl(show.playlistId), '_blank', 'noopener');
  };

  const savedEpisodes = readSavedEpisodes(show.playlistId);
  if (savedEpisodes && savedEpisodes.length) renderEpisodeList(savedEpisodes);

  episodeList.addEventListener('click', (event) => {
    const card = event.target.closest('.episode[data-episode-id]');
    if (!card || event.metaKey || event.ctrlKey || event.shiftKey || event.button) return; // modified clicks open YouTube
    event.preventDefault();
    playEpisode(
      episodes.findIndex((item) => item.id === card.dataset.episodeId),
      true,
    );
  });
  newerButton.onclick = () => playEpisode(currentIndex - 1);
  olderButton.onclick = () => playEpisode(currentIndex + 1);
  poster.addEventListener('click', () => {
    if (episodes.length) playEpisode(currentIndex < 0 ? 0 : currentIndex);
  });

  const readLivePlaylist = () => {
    let attempts = 0;
    // mobile Safari may not load the playlist until asked: cue it explicitly
    try {
      if (!player.getPlaylist() && player.cuePlaylist)
        player.cuePlaylist({ listType: 'playlist', list: show.playlistId });
    } catch (error) {
      /* older player */
    }
    const poll = () => {
      const videoIds = player.getPlaylist && player.getPlaylist();
      if (videoIds && videoIds.length) {
        fetchTitles(videoIds).then((items) => {
          const list = sortNewestFirst(
            items.map((item) => ({ id: item.id, ...parseEpisodeTitle(item.rawTitle, show.name) })),
          );
          if (!list.length) {
            useFallbackList();
            return;
          }
          saveEpisodes(show.playlistId, list);
          renderEpisodeList(list);
          playerReady = true;
          const index = waitingToPlay != null ? waitingToPlay : currentIndex;
          if (waitingToPlay != null) {
            waitingToPlay = null;
            player.loadVideoById(episodes[index].id);
            stage.classList.add('is-playing');
          } else {
            player.cueVideoById(episodes[Math.max(0, index)].id);
          }
        });
        return;
      }
      if (attempts++ < PLAYLIST_POLL_ATTEMPTS) setTimeout(poll, PLAYLIST_POLL_INTERVAL_MS);
      else {
        useFallbackList();
        if (episodes.length) playerReady = true;
      }
    };
    poll();
  };

  loadYouTubeApi()
    .then(() => {
      player = new window.YT.Player('youtube-player', {
        host: 'https://www.youtube-nocookie.com',
        width: '100%',
        height: '100%',
        playerVars: {
          listType: 'playlist',
          list: show.playlistId,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          modestbranding: 1,
        },
        events: {
          onReady: readLivePlaylist,
          onStateChange: (event) => {
            const states = window.YT.PlayerState;
            if (event.data === states.PLAYING || event.data === states.BUFFERING) stage.classList.add('is-playing');
            if (event.data === states.PLAYING) {
              const playingId = player.getVideoData && player.getVideoData().video_id;
              const index = episodes.findIndex((item) => item.id === playingId);
              if (index > -1 && index !== currentIndex) showEpisodeDetails(index);
            }
            // at the end of an episode, carry on with the next one in the list
            if (event.data === states.ENDED && currentIndex < episodes.length - 1) playEpisode(currentIndex + 1);
          },
          onError: () => {
            if (!episodes.length) useFallbackList();
          },
        },
      });
    })
    .catch(useFallbackList);
  setTimeout(() => {
    if (!episodes.length) useFallbackList();
  }, GIVE_UP_AFTER_MS);
}
