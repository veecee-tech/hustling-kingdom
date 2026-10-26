<script setup lang="ts">
import { useAuthStore } from '../features/auth/store';
import GameIcon from './GameIcon.vue';
import CharacterAvatar from './CharacterAvatar.vue';
const auth = useAuthStore();
</script>
<template>
  <section
    class="world-view"
    aria-label="Family House courtyard"
    data-theme="day"
  >
    <svg
      class="world-art"
      viewBox="0 0 1200 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="world-sky" x2="0" y2="1">
          <stop stop-color="#80bdc5" />
          <stop offset="1" stop-color="#d8e4ca" />
        </linearGradient>
        <linearGradient id="world-earth" x2="1" y2="1">
          <stop stop-color="#d2a478" />
          <stop offset="1" stop-color="#ad7756" />
        </linearGradient>
      </defs>
      <path fill="url(#world-sky)" d="M0 0h1200v900H0z" />
      <circle cx="920" cy="150" r="65" fill="#f7df9d" />
      <g fill="#e8efe0" opacity=".65">
        <ellipse cx="220" cy="130" rx="140" ry="24" />
        <ellipse cx="600" cy="95" rx="90" ry="18" />
      </g>
      <g fill="#729a98">
        <path
          d="M0 330h110V210h80v140h60V260h80v120h70V240h90v130h80V180h95v180h65V270h100v90h80V230h85v140h90V300h115v200H0z"
        />
      </g>
      <path d="M0 410h1200v490H0z" fill="url(#world-earth)" />
      <path d="m0 685 1200-80v155L0 850z" fill="#8c8e7a" />
      <path
        d="m0 736 1200-80"
        stroke="#e2c69b"
        stroke-width="5"
        stroke-dasharray="50 40"
      />
      <path d="M0 445h1200v80H0z" fill="#c4aa80" />
      <path d="M0 441h1200" stroke="#e5d5ac" stroke-width="15" />
      <g>
        <path
          d="m145 340 130-123 355 16 100 142-110 14-340-6z"
          fill="#6b6653"
        />
        <path d="m145 340 135-98 340 18 110 115-115-20-330-4z" fill="#975b46" />
        <path d="m180 345 440 10v235l-440-20z" fill="#f0ce94" />
        <path d="m620 355 80-16v210l-80 41z" fill="#bd9a67" />
        <path d="m182 540 438 17v40l-438-20z" fill="#b77b53" />
        <path d="M350 421h94v150h-94z" fill="#496862" />
        <path d="M366 435h62v116h-62z" fill="#304e4c" />
        <circle cx="419" cy="499" r="4" fill="#e9c674" />
        <g fill="#517b7d" stroke="#fff0c2" stroke-width="9">
          <path d="M216 407h90v88h-90zM483 415h89v88h-89z" />
        </g>
        <path d="M261 407v88m267-80v88" stroke="#e2d5ac" stroke-width="5" />
        <path d="m319 577 153 5 29 25-214-7z" fill="#e9c6a0" />
        <path d="m302 599 190 6 20 20-230-7z" fill="#c59b77" />
        <path d="M202 375h390" stroke="#c58a59" stroke-width="7" />
        <rect x="343" y="370" width="107" height="28" rx="4" fill="#56786b" />
        <text
          x="397"
          y="389"
          text-anchor="middle"
          fill="#fff1cc"
          font-size="13"
          font-family="sans-serif"
        >
          FAMILY HOUSE
        </text>
      </g>
      <g>
        <path d="m950 580-20-320" stroke="#7a7350" stroke-width="22" />
        <g fill="#497e63">
          <path
            d="M932 284q-125-137-182-38 110-30 182 38M930 278q-47-173 36-186-27 94-36 186M937 281q130-140 184-40-108-23-184 40M939 286q130-28 161 72-103-64-161-72"
          />
        </g>
      </g>
      <g fill="#5f8757">
        <ellipse cx="128" cy="572" rx="76" ry="35" />
        <ellipse cx="1040" cy="571" rx="100" ry="37" />
        <ellipse cx="1110" cy="840" rx="170" ry="65" />
      </g>
      <g fill="#d8bd8f">
        <path
          d="m690 590 85-8 55 22-85 9zM790 621l85-8 55 22-85 9zM890 651l85-8 55 22-85 9z"
        />
      </g>
      <path
        d="M0 175q600 150 1200 30"
        stroke="#596f63"
        stroke-width="4"
        fill="none"
      />
      <g fill="#f3dfaa">
        <circle cx="180" cy="213" r="7" />
        <circle cx="440" cy="246" r="7" />
        <circle cx="700" cy="247" r="7" />
        <circle cx="960" cy="232" r="7" />
      </g>
      <g fill="#bb7c52">
        <path d="M60 815h50l-7 58H69zM100 804h45l-6 58h-32z" />
      </g>
      <g fill="#4f795a">
        <path
          d="M85 830q-60-100-34-107 40 30 34 107M83 830q4-122 32-111 13 44-32 111M121 817q-40-95-19-101 40 48 19 101"
        />
      </g>
    </svg>
    <div class="location-pill">
      <span class="location-dot" />Old Town <span>/</span> Family House
    </div>
    <template v-if="auth.character">
      <div class="world-player">
        <span class="player-name">{{ auth.character.name }}</span
        ><CharacterAvatar
          :appearance="auth.character.appearance"
          :label="`${auth.character.name}, your character at Family House`"
        />
      </div>
      <RouterLink
        to="/account"
        class="world-hotspot wardrobe-hotspot"
        aria-label="Change your style"
        ><GameIcon name="star" /><span>Your style</span></RouterLink
      >
      <RouterLink to="/city" class="world-hotspot street-hotspot"
        ><GameIcon name="arrow" /><span
          >To the city <small>Locked</small></span
        ></RouterLink
      >
      <div class="world-caption">
        <span>HOME SWEET HOME</span>
        <h1>Family House</h1>
        <p>Your corner of Kingdom City.</p>
      </div>
      <div class="world-actions">
        <RouterLink to="/phone" class="game-button primary"
          ><GameIcon name="phone" />Open phone</RouterLink
        ><button disabled title="Rest is not available yet">
          Rest · Locked
        </button>
      </div>
    </template>
    <div v-else class="world-entry">
      <p>HUSTLING KINGDOM</p>
      <h1>Your life.<br />Your own way.</h1>
      <p>It starts at Family House.</p>
      <RouterLink
        :to="auth.authenticated ? '/create-character' : '/register'"
        class="game-button primary"
        >Start your story</RouterLink
      ><RouterLink
        v-if="!auth.authenticated"
        to="/login"
        class="game-button secondary"
        >Continue your story</RouterLink
      >
    </div>
  </section>
</template>
