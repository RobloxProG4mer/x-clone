#include "algorithm.h"
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
#include <math.h>

#define MAX_AGE_HOURS 72
#define FRESH_TWEET_HOURS 12
#define VIRAL_THRESHOLD 100
#define MIN_ENGAGEMENT_RATIO 0.01

static inline double safe_log(double x) {
    return (x > 0.0) ? log(x + 1.0) : 0.0;
}

static inline int safe_max(int a, int b) {
    return (a > b) ? a : b;
}

static double calculate_time_decay(double age_hours) {
    if (age_hours < 0.0) age_hours = 0.0;
    
    if (age_hours < FRESH_TWEET_HOURS) {
        return 1.0 + (FRESH_TWEET_HOURS - age_hours) / FRESH_TWEET_HOURS * 0.8;
    } else if (age_hours < 24.0) {
        return 1.0 - (age_hours - FRESH_TWEET_HOURS) / (24.0 - FRESH_TWEET_HOURS) * 0.3;
    } else if (age_hours < MAX_AGE_HOURS) {
        return 0.7 - (age_hours - 24.0) / (MAX_AGE_HOURS - 24.0) * 0.5;
    } else {
        return 0.2 * exp(-(age_hours - MAX_AGE_HOURS) / 24.0);
    }
}

static double calculate_engagement_quality(
    int like_count,
    int retweet_count,
    int reply_count,
    int quote_count
) {
    int total_engagement = like_count + retweet_count * 2 + reply_count + quote_count;
    
    if (total_engagement == 0) return 0.1;
    
    double retweet_ratio = (double)retweet_count / safe_max(like_count, 1);
    double reply_ratio = (double)reply_count / safe_max(like_count, 1);
    double quote_ratio = (double)quote_count / safe_max(like_count, 1);
    
    double quality_score = 1.0;
    
    if (retweet_ratio > 0.3) quality_score *= 1.4;
    if (reply_ratio > 0.2) quality_score *= 1.3;
    if (quote_ratio > 0.1) quality_score *= 1.2;
    
    return quality_score;
}

static double calculate_virality_boost(int like_count, int retweet_count, double age_hours) {
    int total_actions = like_count + retweet_count * 2;
    
    if (age_hours < 0.1) age_hours = 0.1;
    
    double velocity = (double)total_actions / age_hours;
    
    double boost = 1.0;
    
    if (total_actions >= VIRAL_THRESHOLD) {
        boost = 1.5 + safe_log(total_actions / (double)VIRAL_THRESHOLD) * 0.3;
    } else if (total_actions >= 50) {
        boost = 1.0 + (double)(total_actions - 50) / 50.0 * 0.5;
    } else if (total_actions >= 20) {
        boost = 1.0 + (double)(total_actions - 20) / 30.0 * 0.3;
    }
    
    if (velocity > 10.0) {
        boost *= 1.0 + safe_log(velocity / 10.0) * 0.2;
    }
    
    return boost;
}

double calculate_score(
    long long created_at,
    int like_count,
    int retweet_count,
    int reply_count,
    int quote_count,
    int has_media,
    double hours_since_seen,
    int author_repeats,
    int content_repeats,
    double novelty_factor,
    double random_factor,
    int all_seen_flag
) {
    if (created_at < 0) created_at = 0;
    if (like_count < 0) like_count = 0;
    if (retweet_count < 0) retweet_count = 0;
    if (reply_count < 0) reply_count = 0;
    if (quote_count < 0) quote_count = 0;
    if (has_media < 0) has_media = 0;
    if (!isfinite(hours_since_seen)) hours_since_seen = -1.0;
    if (hours_since_seen < -1.0) hours_since_seen = -1.0;
    if (author_repeats < 0) author_repeats = 0;
    if (content_repeats < 0) content_repeats = 0;
    if (!isfinite(novelty_factor) || novelty_factor <= 0.0) novelty_factor = 1.0;
    if (!isfinite(random_factor) || random_factor < 0.0) random_factor = 0.0;
    if (random_factor > 1.0) random_factor = 1.0;
    if (all_seen_flag != 0) all_seen_flag = 1;
    
    time_t now = time(NULL);
    double age_hours = (double)(now - created_at) / 3600.0;
    
    int total_engagement = like_count + retweet_count + reply_count + quote_count;
    
    if (age_hours > MAX_AGE_HOURS && total_engagement < 5) {
        return 0.0;
    }
    
    double time_decay = calculate_time_decay(age_hours);
    
    double engagement_quality = calculate_engagement_quality(
        like_count, retweet_count, reply_count, quote_count
    );
    
    double virality_boost = calculate_virality_boost(like_count, retweet_count, age_hours);
    
    double base_score = safe_log(like_count + 1) * 2.0 +
                       safe_log(retweet_count + 1) * 3.0 +
                       safe_log(reply_count + 1) * 1.5 +
                       safe_log(quote_count + 1) * 2.5;
    
    double diversity_bonus = 1.0;
    int engagement_types = 0;
    if (like_count > 0) engagement_types++;
    if (retweet_count > 0) engagement_types++;
    if (reply_count > 0) engagement_types++;
    if (quote_count > 0) engagement_types++;
    diversity_bonus = 1.0 + (engagement_types - 1) * 0.15;
    
    double media_boost = 1.0;
    if (has_media > 0) {
        media_boost = 1.15;
    }
    
    if (quote_count > 0 && has_media > 0) {
        media_boost *= 1.1;
    }

    double seen_penalty = 1.0;
    if (hours_since_seen >= 0.0) {
        if (hours_since_seen < 0.5) {
            seen_penalty = 0.14;
        } else if (hours_since_seen < 2.0) {
            seen_penalty = 0.22;
        } else if (hours_since_seen < 6.0) {
            seen_penalty = 0.34;
        } else if (hours_since_seen < 12.0) {
            seen_penalty = 0.48;
        } else if (hours_since_seen < 24.0) {
            seen_penalty = 0.65;
        } else if (hours_since_seen < 48.0) {
            seen_penalty = 0.8;
        } else if (hours_since_seen < 96.0) {
            seen_penalty = 0.9;
        } else {
            seen_penalty = 0.96;
        }
    }

    double author_penalty = 1.0 / (1.0 + (double)author_repeats * 0.45);
    if (author_penalty < 0.38) author_penalty = 0.38;

    double content_penalty = 1.0 / (1.0 + (double)content_repeats * 0.6);
    if (content_penalty < 0.28) content_penalty = 0.28;

    double recency_adjust = 1.0;
    if (age_hours < 0.5) {
        recency_adjust = 1.12;
    } else if (age_hours < 3.0) {
        recency_adjust = 1.06;
    } else if (age_hours > 72.0) {
        recency_adjust = 0.7;
    } else if (age_hours > 48.0) {
        recency_adjust = 0.82;
    }

    double discussion_boost = 1.0;
    if (reply_count > 0 && like_count > 0) {
        double reply_ratio = (double)reply_count / (double)safe_max(like_count, 1);
        if (reply_ratio > 0.0) {
            if (reply_ratio > 0.5) reply_ratio = 0.5;
            discussion_boost += reply_ratio * 0.7;
        }
    }

    double novelty_boost = novelty_factor;
    if (hours_since_seen < 0.0) {
        novelty_boost += 0.12;
    }
    if (novelty_boost < 0.75) novelty_boost = 0.75;
    if (novelty_boost > 1.5) novelty_boost = 1.5;

    double random_span = all_seen_flag ? 0.55 : 0.1;
    double random_offset = all_seen_flag ? 0.25 : 0.04;
    double random_component = random_offset + random_factor * random_span;
    double random_multiplier = 1.0 + random_component * 0.08;
    
    double final_score = base_score * 
                        time_decay * 
                        engagement_quality * 
                        virality_boost * 
                        diversity_bonus * 
                        media_boost *
                        seen_penalty *
                        author_penalty *
                        content_penalty *
                        recency_adjust *
                        discussion_boost *
                        novelty_boost *
                        random_multiplier;

    final_score += random_component;
    
    if (final_score < 0.0) final_score = 0.0;
    
    return final_score;
}

static int compare_tweets(const void *a, const void *b) {
    if (a == NULL || b == NULL) return 0;
    
    const Tweet *tweet_a = (const Tweet *)a;
    const Tweet *tweet_b = (const Tweet *)b;
    
    if (tweet_b->score > tweet_a->score) return 1;
    if (tweet_b->score < tweet_a->score) return -1;
    return 0;
}

void rank_tweets(Tweet *tweets, size_t count) {
    if (tweets == NULL || count == 0) return;
    
    static int seeded = 0;
    if (!seeded) {
        srand((unsigned int)time(NULL));
        seeded = 1;
    }

    for (size_t i = 0; i < count; i++) {
        double base_score = calculate_score(
            tweets[i].created_at,
            tweets[i].like_count,
            tweets[i].retweet_count,
            tweets[i].reply_count,
            tweets[i].quote_count,
            tweets[i].has_media,
            tweets[i].hours_since_seen,
            tweets[i].author_repeats,
            tweets[i].content_repeats,
            tweets[i].novelty_factor,
            tweets[i].random_factor,
            tweets[i].all_seen_flag
        );

        tweets[i].score = base_score;
    }
    
    qsort(tweets, count, sizeof(Tweet), compare_tweets);

    if (count > 3) {
        for (size_t i = 2; i < count && i < 12; i += 3) {
            size_t swap_with = i - 1;
            if (swap_with < count) {
                double roll = (double)rand() / (double)RAND_MAX;
                if (roll < 0.55) {
                    Tweet temp = tweets[i];
                    tweets[i] = tweets[swap_with];
                    tweets[swap_with] = temp;
                }
            }
        }
    }
}

char *process_timeline(const char *json_input) {
    (void)json_input;
    return strdup("{\"ranked_ids\":[]}");
}
