import { dlopen, FFIType, suffix } from "bun:ffi";
import { existsSync } from "fs";
import path from "path";

const libPath = path.join(import.meta.dir, `algorithm.${suffix}`);

let lib = null;

if (existsSync(libPath)) {
  try {
    lib = dlopen(libPath, {
      calculate_score: {
        args: [
          FFIType.i64,
          FFIType.i32,
          FFIType.i32,
          FFIType.i32,
          FFIType.i32,
          FFIType.i32,
          FFIType.double,
          FFIType.i32,
          FFIType.i32,
          FFIType.double,
          FFIType.double,
          FFIType.i32,
        ],
        returns: FFIType.double,
      },
    });
    console.log("✓ C algorithm library loaded successfully");
  } catch (error) {
    console.warn(
      "Failed to load C algorithm library, using JavaScript fallback"
    );
    console.warn("Error:", error.message);
  }
} else {
  console.warn(
    `C algorithm library not found at ${libPath}, using JavaScript fallback`
  );
  console.warn("Run 'make' in src/algo/ to compile the C algorithm");
}

export const calculateScore = (
  created_at,
  like_count,
  retweet_count,
  reply_count = 0,
  quote_count = 0,
  has_media = 0,
  hours_since_seen = -1,
  author_repeats = 0,
  content_repeats = 0,
  novelty_factor = 1,
  random_factor = Math.random(),
  is_all_seen = 0
) => {
  if (!lib) {
    const now = Math.floor(Date.now() / 1000);
    const ageHours = (now - created_at) / 3600;

    const MAX_AGE_HOURS = 72;
    const FRESH_TWEET_HOURS = 12;

    const totalEngagement =
      like_count + retweet_count + reply_count + quote_count;

    if (ageHours > MAX_AGE_HOURS && totalEngagement < 5) {
      return 0;
    }

    const calculateTimeDecay = (age) => {
      if (age < FRESH_TWEET_HOURS) {
        return 1.0 + ((FRESH_TWEET_HOURS - age) / FRESH_TWEET_HOURS) * 0.8;
      } else if (age < 24) {
        return (
          1.0 - ((age - FRESH_TWEET_HOURS) / (24 - FRESH_TWEET_HOURS)) * 0.3
        );
      } else if (age < MAX_AGE_HOURS) {
        return 0.7 - ((age - 24) / (MAX_AGE_HOURS - 24)) * 0.5;
      } else {
        return 0.2 * Math.exp(-(age - MAX_AGE_HOURS) / 24);
      }
    };

    const retweetRatio = retweet_count / Math.max(like_count, 1);
    const replyRatio = reply_count / Math.max(like_count, 1);
    const quoteRatio = quote_count / Math.max(like_count, 1);

    let qualityScore = 1.0;
    if (retweetRatio > 0.3) qualityScore *= 1.4;
    if (replyRatio > 0.2) qualityScore *= 1.3;
    if (quoteRatio > 0.1) qualityScore *= 1.2;

    const totalActions = like_count + retweet_count * 2;
    const velocity = totalActions / Math.max(ageHours, 0.1);

    let viralityBoost = 1.0;
    if (totalActions >= 100) {
      viralityBoost = 1.5 + Math.log(totalActions / 100 + 1) * 0.3;
    } else if (totalActions >= 50) {
      viralityBoost = 1.0 + ((totalActions - 50) / 50) * 0.5;
    } else if (totalActions >= 20) {
      viralityBoost = 1.0 + ((totalActions - 20) / 30) * 0.3;
    }

    if (velocity > 10) {
      viralityBoost *= 1.0 + Math.log(velocity / 10 + 1) * 0.2;
    }

    const baseScore =
      Math.log(like_count + 1) * 2.0 +
      Math.log(retweet_count + 1) * 3.0 +
      Math.log(reply_count + 1) * 1.5 +
      Math.log(quote_count + 1) * 2.5;

    let engagementTypes = 0;
    if (like_count > 0) engagementTypes++;
    if (retweet_count > 0) engagementTypes++;
    if (reply_count > 0) engagementTypes++;
    if (quote_count > 0) engagementTypes++;
    const diversityBonus = 1.0 + (engagementTypes - 1) * 0.15;

    let mediaBoost = 1.0;
    if (has_media > 0) {
      mediaBoost = 1.15;
    }
    if (quote_count > 0 && has_media > 0) {
      mediaBoost *= 1.1;
    }

    const timeDecay = calculateTimeDecay(ageHours);

    let seenPenalty = 1.0;
    if (Number.isFinite(hours_since_seen) && hours_since_seen >= 0) {
      if (hours_since_seen < 0.5) seenPenalty = 0.14;
      else if (hours_since_seen < 2) seenPenalty = 0.22;
      else if (hours_since_seen < 6) seenPenalty = 0.34;
      else if (hours_since_seen < 12) seenPenalty = 0.48;
      else if (hours_since_seen < 24) seenPenalty = 0.65;
      else if (hours_since_seen < 48) seenPenalty = 0.8;
      else if (hours_since_seen < 96) seenPenalty = 0.9;
      else seenPenalty = 0.96;
    }

    const authorPenalty = Math.max(0.38, 1 / (1 + Math.max(0, author_repeats) * 0.45));
    const contentPenalty = Math.max(0.28, 1 / (1 + Math.max(0, content_repeats) * 0.6));

    let recencyAdjust = 1.0;
    if (ageHours < 0.5) recencyAdjust = 1.12;
    else if (ageHours < 3) recencyAdjust = 1.06;
    else if (ageHours > 72) recencyAdjust = 0.7;
    else if (ageHours > 48) recencyAdjust = 0.82;

    let discussionBoost = 1.0;
    if (reply_count > 0 && like_count > 0) {
      const replyRatio = Math.min(reply_count / Math.max(like_count, 1), 0.5);
      discussionBoost += replyRatio * 0.7;
    }

    let noveltyBoost = novelty_factor;
    if (!Number.isFinite(noveltyBoost) || noveltyBoost <= 0) noveltyBoost = 1.0;
    if (hours_since_seen < 0) {
      noveltyBoost += 0.12;
    }
    noveltyBoost = Math.min(Math.max(noveltyBoost, 0.75), 1.5);

    const boundedRandom = Math.min(Math.max(random_factor || 0, 0), 1);
    const randomSpan = is_all_seen ? 0.55 : 0.1;
    const randomOffset = is_all_seen ? 0.25 : 0.04;
    const randomComponent = randomOffset + boundedRandom * randomSpan;
    const randomMultiplier = 1 + randomComponent * 0.08;

    return Math.max(
      0,
      baseScore *
        timeDecay *
        qualityScore *
        viralityBoost *
        diversityBonus *
        mediaBoost *
        seenPenalty *
        authorPenalty *
        contentPenalty *
        recencyAdjust *
        discussionBoost *
        noveltyBoost *
        randomMultiplier +
        randomComponent
    );
  }

  const timestamp =
    typeof created_at === "string"
      ? Math.floor(new Date(created_at).getTime() / 1000)
      : created_at;

  return lib.symbols.calculate_score(
    BigInt(timestamp),
    like_count,
    retweet_count,
    reply_count,
    quote_count,
    has_media,
    hours_since_seen,
    author_repeats,
    content_repeats,
    novelty_factor,
    random_factor,
    is_all_seen
  );
};

const normalizeContent = (value) => {
  if (typeof value !== "string") return "";
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

export const rankTweets = (tweets, seenInput = new Map()) => {
  if (!Array.isArray(tweets) || tweets.length === 0) return [];

  let seenMap;
  if (seenInput instanceof Map) {
    seenMap = seenInput;
  } else if (seenInput instanceof Set) {
    seenMap = new Map();
    seenInput.forEach((id) => seenMap.set(id, null));
  } else {
    seenMap = new Map();
  }

  const nowMillis = Date.now();
  const nowSeconds = Math.floor(nowMillis / 1000);

  const authorCounts = new Map();
  const contentCounts = new Map();

  tweets.forEach((tweet) => {
    const authorKey =
      tweet.user_id ||
      tweet.author_id ||
      tweet.author?.id ||
      tweet.username ||
      tweet.author?.username;
    if (authorKey) {
      authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
    }

    const contentKey = normalizeContent(tweet.content);
    if (contentKey) {
      contentCounts.set(contentKey, (contentCounts.get(contentKey) || 0) + 1);
    }
  });

  const allSeen = tweets.every((tweet) => seenMap.has(tweet.id));

  const scored = tweets.map((tweet) => {
    let timestamp =
      typeof tweet.created_at === "string"
        ? Math.floor(new Date(tweet.created_at).getTime() / 1000)
        : tweet.created_at;
    if (!Number.isFinite(timestamp)) {
      timestamp = nowSeconds;
    }

    const attachments = Array.isArray(tweet.attachments)
      ? tweet.attachments
      : [];
    const hasQuotedMedia =
      tweet.quoted_tweet &&
      Array.isArray(tweet.quoted_tweet.attachments) &&
      tweet.quoted_tweet.attachments.length > 0;
    const hasMedia = attachments.length > 0 || hasQuotedMedia ? 1 : 0;

    const authorKey =
      tweet.user_id ||
      tweet.author_id ||
      tweet.author?.id ||
      tweet.username ||
      tweet.author?.username;
    const authorCount = authorKey ? authorCounts.get(authorKey) || 0 : 0;

    const contentKey = normalizeContent(tweet.content);
    const contentCount = contentKey ? contentCounts.get(contentKey) || 0 : 0;

    const seenMeta = seenMap.get(tweet.id);
    let hoursSinceSeen = -1;
    if (seenMeta !== undefined && seenMeta !== null) {
      const parsed = Date.parse(
        typeof seenMeta === "string" && !seenMeta.endsWith("Z")
          ? `${seenMeta}Z`
          : seenMeta
      );
      if (Number.isFinite(parsed)) {
        hoursSinceSeen = Math.max(0, (nowMillis - parsed) / 3600000);
      }
    }

    let noveltyFactor = 1.0;
    if (hoursSinceSeen < 0) {
      noveltyFactor = 1.2;
    } else if (hoursSinceSeen > 72) {
      noveltyFactor = 1.05;
    }

    const randomFactor = Math.random();

    const score = calculateScore(
      timestamp,
      tweet.like_count || 0,
      tweet.retweet_count || 0,
      tweet.reply_count || 0,
      tweet.quote_count || 0,
      hasMedia,
      hoursSinceSeen,
      Math.max(0, authorCount - 1),
      Math.max(0, contentCount - 1),
      noveltyFactor,
      randomFactor,
      allSeen ? 1 : 0
    );

    return { ...tweet, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored.map(({ _score, ...rest }) => rest);
};

export const isAlgorithmAvailable = () => lib !== null;
