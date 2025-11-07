const notificationIconMap = {
  default:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell-icon lucide-bell"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>',
  reaction:
    '<svg width="16" height="16" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" stroke-width="3" /><circle cx="22" cy="26" r="2" fill="currentColor" /><circle cx="42" cy="26" r="2" fill="currentColor" /><path d="M22 40c3 3 7 5 10 5s7-2 10-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none" /></svg>',
  like: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M5.00002 2.54822C8.00003 2.09722 9.58337 4.93428 10 5.87387C10.4167 4.93428 12 2.09722 15 2.54822C18 2.99923 18.75 5.66154 18.75 7.05826C18.75 9.28572 18.1249 10.9821 16.2499 13.244C14.3749 15.506 10 18.3333 10 18.3333C10 18.3333 5.62498 15.506 3.74999 13.244C1.875 10.9821 1.25 9.28572 1.25 7.05826C1.25 5.66154 2 2.99923 5.00002 2.54822Z"/></svg>',
  retweet:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.53001 7.81595C3.49179 4.73911 6.43281 2.5 9.91173 2.5C13.1684 2.5 15.9537 4.46214 17.0852 7.23684L17.6179 8.67647M17.6179 8.67647L18.5002 4.26471M17.6179 8.67647L13.6473 6.91176M17.4995 12.1841C16.5378 15.2609 13.5967 17.5 10.1178 17.5C6.86118 17.5 4.07589 15.5379 2.94432 12.7632L2.41165 11.3235M2.41165 11.3235L1.5293 15.7353M2.41165 11.3235L6.38224 13.0882"/></svg>',
  reply:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18.7502 11V7.50097C18.7502 4.73917 16.5131 2.50033 13.7513 2.50042L6.25021 2.50044C3.48848 2.5004 1.25017 4.73875 1.2502 7.50048L1.25021 10.9971C1.2502 13.749 3.47395 15.9836 6.22586 15.9971L6.82888 16V19.0182L12.1067 16H13.7502C16.5116 16 18.7502 13.7614 18.7502 11Z"/></svg>',
  follow:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18.6471 15.3333V18.6667M18.6471 18.6667L18.6471 22M18.6471 18.6667H22M18.6471 18.6667H15.2941M3 22C3 17.7044 6.69722 14.2222 11.258 14.2222C12.0859 14.2222 12.8854 14.3369 13.6394 14.5505M16.4118 6.44444C16.4118 8.89904 14.4102 10.8889 11.9412 10.8889C9.47214 10.8889 7.47059 8.89904 7.47059 6.44444C7.47059 3.98985 9.47214 2 11.9412 2C14.4102 2 16.4118 3.98985 16.4118 6.44444Z"/></svg>',
  affiliate_approved:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18.6471 15.3333V18.6667M18.6471 18.6667L18.6471 22M18.6471 18.6667H22M18.6471 18.6667H15.2941M3 22C3 17.7044 6.69722 14.2222 11.258 14.2222C12.0859 14.2222 12.8854 14.3369 13.6394 14.5505M16.4118 6.44444C16.4118 8.89904 14.4102 10.8889 11.9412 10.8889C9.47214 10.8889 7.47059 8.89904 7.47059 6.44444C7.47059 3.98985 9.47214 2 11.9412 2C14.4102 2 16.4118 3.98985 16.4118 6.44444Z"/></svg>',
  quote:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>',
  mention:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18.6471 15.3333V18.6667M18.6471 18.6667L18.6471 22M18.6471 18.6667H22M18.6471 18.6667H15.2941M3 22C3 17.7044 6.69722 14.2222 11.258 14.2222C12.0859 14.2222 12.8854 14.3369 13.6394 14.5505M16.4118 6.44444C16.4118 8.89904 14.4102 10.8889 11.9412 10.8889C9.47214 10.8889 7.47059 8.89904 7.47059 6.44444C7.47059 3.98985 9.47214 2 11.9412 2C14.4102 2 16.4118 3.98985 16.4118 6.44444Z"/></svg>',
  community_join_request:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3 6 6 .5-4.5 3 1.5 6L12 14l-6 4 1.5-6L3 8.5 9 8 12 2z"/></svg>',
  affiliate_request:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3 6 6 .5-4.5 3 1.5 6L12 14 6 18l1.5-6L3 8.5 9 8 12 2z"/></svg>',
  community_join_approved:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 6L9 17l-5-5"/></svg>',
  community_join_rejected:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  community_role_change:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l4 4-4 4-4-4 4-4z"/><path d="M6 14v6h12v-6"/></svg>',
  community_ban:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z"/><path d="M9 9l6 6"/></svg>',
  community_unban:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M8 12h8"/></svg>',
};

const notificationIconClasses = {
  default: "default-icon",
  reaction: "reaction-icon",
  like: "like-icon",
  retweet: "retweet-icon",
  reply: "reply-icon",
  follow: "follow-icon",
  quote: "quote-icon",
  mention: "mention-icon",
  community_join_request: "community-join-request-icon",
  affiliate_request: "affiliate-request-icon",
  community_join_approved: "community-join-approved-icon",
  community_join_rejected: "community-join-rejected-icon",
  community_role_change: "community-role-change-icon",
  community_ban: "community-ban-icon",
  community_unban: "community-unban-icon",
};

const notificationIconTypes = Object.freeze(Object.keys(notificationIconMap));

if (typeof window !== "undefined") {
  window.NOTIFICATION_ICON_MAP = notificationIconMap;
  window.NOTIFICATION_ICON_CLASSES = notificationIconClasses;
  window.NOTIFICATION_ICON_TYPES = notificationIconTypes;
  window.dispatchEvent(new CustomEvent("notification-icons-ready"));
}

export const NOTIFICATION_ICON_MAP = notificationIconMap;
export const NOTIFICATION_ICON_CLASSES = notificationIconClasses;
export const NOTIFICATION_ICON_TYPES = notificationIconTypes;
