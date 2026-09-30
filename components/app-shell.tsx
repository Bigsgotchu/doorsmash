"use client";

import {
  FormEvent,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSupabase } from "@/lib/providers/supabase-provider";
import type { Profile, DateIdea, Message } from "@/lib/types";
import Link from "next/link";
import { signout } from "@/lib/actions/auth";

type Section = "Discover" | "Matches" | "Messages" | "Profile";
type Overlay = "match" | "chat" | "schedule" | null;

interface EnrichedMatch {
  match_id: string;
  other_user: Profile | null;
  conversation_id: string | null;
  last_message: Message | null;
  unread_count: number;
  matched_at: string;
}

interface AppShellProps {
  initialUser: Profile;
  initialProfiles: Profile[];
  initialDateIdeas: DateIdea[];
  initialUnreadNotifications: number;
}

export default function AppShell({
  initialUser,
  initialProfiles,
  initialDateIdeas,
  initialUnreadNotifications,
}: AppShellProps) {
  const { supabase, user } = useSupabase();
  const [section, setSection] = useState<Section>("Discover");
  const [profileIndex, setProfileIndex] = useState(0);
  const [candidateProfiles, setCandidateProfiles] = useState<Profile[]>(
    initialProfiles,
  );
  const [matches, setMatches] = useState<EnrichedMatch[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedDate, setSelectedDate] = useState<DateIdea>(
    initialDateIdeas[0] ?? {
      id: 0,
      title: "",
      category: "OTHER",
      description: "",
      image_url: "",
      created_at: new Date().toISOString(),
    },
  );
  const [dateIdeas] = useState<DateIdea[]>(initialDateIdeas);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [currentMatch, setCurrentMatch] = useState<EnrichedMatch | null>(null);
  const [toast, setToast] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(
    initialUnreadNotifications,
  );
  const [loadingSwipe, setLoadingSwipe] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentUser = initialUser;

  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2800);
  }, []);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches");
      const { data } = await res.json();
      setMatches(data ?? []);
    } catch {
      // Silently fail on match fetch
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchMatches();
    })();
    // Poll for notifications every 30 seconds
    const interval = window.setInterval(async () => {
      const res = await fetch("/api/notifications");
      const { data } = await res.json();
      setUnreadNotifications(data.length);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Realtime subscription for the current conversation's messages
  useEffect(() => {
    if (!currentConversationId) return;

    const channel = supabase
      .channel(`messages:conversation_id=eq.${currentConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${currentConversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentConversationId, supabase]);

  const fetchConversationMessages = useCallback(
    async (conversationId: string) => {
      const res = await fetch(
        `/api/messages?conversation_id=${conversationId}`,
      );
      const { data } = await res.json();
      setMessages(data ?? []);
      setCurrentConversationId(conversationId);
    },
    [],
  );

  const fetchMoreProfiles = useCallback(async () => {
    try {
      const res = await fetch("/api/profiles?limit=10");
      const { data } = await res.json();
      setCandidateProfiles((prev) => [...prev, ...(data ?? [])]);
    } catch {
      // Silently fail on profile fetch
    }
  }, []);

  const profile =
    candidateProfiles[profileIndex % candidateProfiles.length] ?? null;

  const matchedProfile =
    currentMatch?.other_user ?? matches[0]?.other_user ?? null;

  const advanceProfile = () => {
    setProfileIndex((current) => current + 1);
    if (profileIndex >= candidateProfiles.length - 2) {
      void fetchMoreProfiles();
    }
  };

  const smashProfile = async () => {
    if (!profile || loadingSwipe) return;
    setLoadingSwipe(true);

    try {
      const res = await fetch("/api/swipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_id: profile.id,
          direction: "like",
        }),
      });

      const result = await res.json();

      if (result.matched) {
        setOverlay("match");
        await fetchMatches();
        setUnreadNotifications(0);
      } else {
        notify(`Smash sent to ${profile.display_name || profile.full_name}`);
      }
    } catch {
      notify("Something went wrong. Try again.");
    } finally {
      setLoadingSwipe(false);
      advanceProfile();
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !currentConversationId) return;

    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: currentConversationId,
          content: trimmedMessage,
        }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          conversation_id: currentConversationId,
          sender_id: user?.id ?? "",
          content: trimmedMessage,
          created_at: new Date().toISOString(),
        },
      ]);
      setMessage("");
    } catch {
      notify("Failed to send message.");
    }
  };

  const proposeDate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOverlay(null);
    if (!currentMatch || !currentMatch.conversation_id) return;

    const form = event.currentTarget;
    const dateInput = form.elements.namedItem("date") as HTMLInputElement;
    const timeInput = form.elements.namedItem("time") as HTMLSelectElement;
    const noteInput = form.elements.namedItem("note") as HTMLTextAreaElement;

    const [hour, minute] = timeInput.value.split(":");
    const [year, month, day] = dateInput.value.split("-");
    const proposedTime = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
    ).toISOString();

    try {
      await fetch("/api/date-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          match_id: currentMatch.match_id,
          conversation_id: currentMatch.conversation_id,
          date_idea_id: selectedDate.id,
          proposed_time: proposedTime,
          note: noteInput.value,
        }),
      });
      notify(
        `Date idea sent to ${matchedProfile?.display_name || matchedProfile?.full_name}`,
      );
    } catch {
      notify("Failed to send date idea.");
    }
  };

  function chooseDate(idea: DateIdea) {
    setSelectedDate(idea);
    setOverlay("schedule");
  }

  function openChat(matchEntry: EnrichedMatch) {
    setCurrentMatch(matchEntry);
    setSection("Messages");
    setOverlay("chat");
    setMessages([]);
    if (matchEntry.conversation_id) {
      void fetchConversationMessages(matchEntry.conversation_id);
    }
  }

  function openSchedule(matchEntry: EnrichedMatch) {
    setCurrentMatch(matchEntry);
    setOverlay("schedule");
    setSelectedDate(dateIdeas[0] ?? selectedDate);
  }

  function navButton(label: Section, compact = false) {
    return (
      <button
        aria-current={section === label ? "page" : undefined}
        className={`nav-link${section === label ? " is-active" : ""}${compact ? " nav-link-compact" : ""}`}
        key={label}
        onClick={() => setSection(label)}
        type="button"
      >
        <span className="nav-mark" aria-hidden="true">
          {label === "Discover" ? "D" : label === "Matches" ? "M" : label === "Messages" ? "C" : "P"}
        </span>
        <span>{label}</span>
        {label === "Matches" && matches.length > 0 && (
          <span className="nav-count">{matches.length}</span>
        )}
      </button>
    );
  }

  const displayProfile = profile ?? {
    id: "",
    email: "",
    display_name: "Loading…",
    full_name: "",
    age: 0,
    bio: "",
    neighborhood: "—",
    location: "—",
    distance_preference: 25,
    is_verified: false,
    is_profile_complete: false,
    created_at: "",
    updated_at: "",
    primary_photo_url: "https://via.placeholder.com/400x600?text=Loading",
  };

  const profilePhoto = displayProfile.primary_photo_url || "/window.svg";

  function renderDiscovery() {
    return (
      <div className="discovery-layout">
        <section className="people-column" aria-labelledby="discovery-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A GOOD PLACE TO START</p>
              <h1 id="discovery-heading">Meet someone.<br /><em>Make a plan.</em></h1>
            </div>
            <button
              className="location-button"
              onClick={() => notify("Showing people near your location")}
              type="button"
            >
              <span aria-hidden="true">⌖</span> {currentUser.location || "Set location"} <span aria-hidden="true">⌄</span>
            </button>
          </div>

          <article className="profile-card" aria-label={`${displayProfile.display_name || displayProfile.full_name}, ${displayProfile.age}`}>
            <div
              className="profile-photo"
              role="img"
              aria-label={`Portrait of ${displayProfile.display_name || displayProfile.full_name}`}
              style={{ backgroundImage: `url("${profilePhoto}")` }}
            >
              <div className="photo-topline">
                <span className="online-pill"><span /> Around this week</span>
                <details className="safety-menu">
                  <summary aria-label="Profile safety options">•••</summary>
                  <div className="safety-options">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch("/api/reports", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              reported_id: displayProfile.id,
                              reason: "spam",
                              details: "Reported from discovery",
                            }),
                          });
                          notify(`${displayProfile.display_name || displayProfile.full_name} has been blocked and reported`);
                          advanceProfile();
                        } catch {
                          notify("Failed to report user.");
                        }
                      }}
                    >
                      Report profile
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await fetch("/api/reports", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              reported_id: displayProfile.id,
                              reason: "harassment",
                              details: "User blocked from discovery",
                            }),
                          });
                          notify(`${displayProfile.display_name || displayProfile.full_name} has been blocked`);
                          advanceProfile();
                        } catch {
                          notify("Failed to block user.");
                        }
                      }}
                    >
                      Block profile
                    </button>
                  </div>
                </details>
              </div>
              <div className="photo-caption">
                <div className="profile-name-line">
                  <h2>{displayProfile.display_name || displayProfile.full_name || "Unknown"}, {displayProfile.age}</h2>
                  {displayProfile.is_verified && (
                    <span className="verified-mark" title="Photo verified" aria-label="Photo verified">✓</span>
                  )}
                </div>
                <p>{displayProfile.neighborhood} <span>·</span> {displayProfile.location || "Nearby"}</p>
              </div>
            </div>
            <div className="profile-details">
              <div className="profile-prompt">
                <p className="eyebrow">About</p>
                <p className="prompt-answer">&quot;{displayProfile.bio || "No bio yet."}&quot;</p>
              </div>
              <div className="profile-actions">
                <button className="pass-button" onClick={advanceProfile} type="button">
                  <span aria-hidden="true">×</span><span className="sr-only">Pass</span>
                </button>
                <button
                  className={`smash-button ${loadingSwipe ? "loading" : ""}`}
                  onClick={smashProfile}
                  disabled={loadingSwipe}
                  type="button"
                >
                  <span aria-hidden="true">♥</span> {loadingSwipe ? "Sending…" : "Smash"}
                </button>
                <button
                  className="wave-button"
                  onClick={() => {
                    notify(`A wave is on its way to ${displayProfile.display_name || displayProfile.full_name}`);
                    advanceProfile();
                  }}
                  type="button"
                >
                  Say hi <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </article>
          <p className="privacy-note"><span aria-hidden="true">✳</span> Your profile is only shown to people you can discover.</p>
        </section>

        <aside className="date-column" aria-labelledby="date-ideas-heading">
          <div className="date-heading-row">
            <div>
              <p className="eyebrow">LESS &quot;WHAT SHOULD WE DO?&quot;</p>
              <h2 id="date-ideas-heading">Date Cards</h2>
            </div>
            <button className="text-link" onClick={() => notify("More date cards are coming soon")} type="button">See all <span aria-hidden="true">↗</span></button>
          </div>
          <p className="date-intro">Pick a plan that feels like you. Send it when the feeling&apos;s mutual.</p>
          <div className="date-card-list">
            {dateIdeas.map((idea, index) => (
              <button className="date-card" key={idea.id || idea.title} onClick={() => chooseDate(idea)} type="button">
                <span
                  className="date-card-image"
                  role="img"
                  aria-label={idea.category.toLowerCase()}
                  style={{ backgroundImage: `url("${idea.image_url || idea.image_url}")` }}
                />
                <span className="date-card-content">
                  <span className="date-card-category">{idea.category} <span>0{index + 1}</span></span>
                  <span className="date-card-title">{idea.title}</span>
                  <span className="date-card-detail">{idea.description || ""}</span>
                </span>
                <span className="date-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <div className="date-note"><span className="note-star" aria-hidden="true">✳</span><p><strong>Good dates start with a plan.</strong><br />Keep the chat light. Meet somewhere public. Have fun.</p></div>
        </aside>
      </div>
    );
  }

  function renderMatches() {
    return (
      <section className="secondary-view">
        <p className="eyebrow">THE FEELING IS MUTUAL</p>
        <h1>Your <em>matches.</em></h1>
        {matches.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol" aria-hidden="true">♥</span>
            <h2>No matches just yet</h2>
            <p>When someone smashes you back, you&apos;ll find them here.</p>
            <button
              className="smash-button"
              onClick={() => setSection("Discover")}
              type="button"
            >
              Back to discovery
            </button>
          </div>
        ) : (
          <div className="match-grid">
            {matches.map((entry) => (
              <button
                className="match-tile"
                key={entry.match_id}
                onClick={() => openChat(entry)}
                type="button"
              >
                <span
                  className="match-photo"
                  role="img"
                  aria-label={`Portrait of ${entry.other_user?.display_name || entry.other_user?.full_name}`}
                  style={{
                    backgroundImage: `url("${entry.other_user?.primary_photo_url || ""}")`,
                  }}
                />
                <span className="match-name">
                  {entry.other_user?.display_name || entry.other_user?.full_name || "Unknown"},{" "}
                  {entry.other_user?.age}
                </span>
                <span className="match-subtitle">You both said smash</span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  function renderMessages() {
    return (
      <section className="secondary-view messages-view">
        <p className="eyebrow">SAY THE THING</p>
        <h1>Your <em>conversations.</em></h1>
        {matches.length === 0 ? (
          <div className="empty-state">
            <span className="empty-symbol" aria-hidden="true">↗</span>
            <h2>Your next good conversation starts with a match</h2>
            <p>Keep discovering. We&apos;ll save the hellos for here.</p>
            <button
              className="smash-button"
              onClick={() => setSection("Discover")}
              type="button"
            >
              Meet someone
            </button>
          </div>
        ) : (
          <div className="conversation-shell">
            {matches.map((entry) => (
              <button
                className="conversation-person"
                key={entry.match_id}
                onClick={() => openChat(entry)}
                type="button"
              >
                <span
                  className="conversation-avatar"
                  role="img"
                  aria-label={`Portrait of ${entry.other_user?.display_name || entry.other_user?.full_name}`}
                  style={{
                    backgroundImage: `url("${entry.other_user?.primary_photo_url || ""}")`,
                  }}
                />
                <span>
                  <strong>{entry.other_user?.display_name || entry.other_user?.full_name || "Unknown"}</strong>
                  <small>
                    {entry.last_message?.content || "Say hello!"}
                  </small>
                </span>
                <span className="date-arrow" aria-hidden="true">›</span>
              </button>
            ))}
            {currentMatch && currentMatch.conversation_id && (
              <button
                className="schedule-inline"
                onClick={() => openSchedule(currentMatch)}
                type="button"
              >
                <span aria-hidden="true">✳</span> Send a Date Card
              </button>
            )}
          </div>
        )}
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className="secondary-view">
        <p className="eyebrow">YOUR SIDE OF THE STORY</p>
        <h1>Make it <em>you.</em></h1>
        <div className="profile-setup">
          <span className="setup-avatar">
            {currentUser.display_name?.charAt(0) ||
              currentUser.full_name?.charAt(0) ||
              currentUser.email?.charAt(0) ||
              "U"}
          </span>
          <div>
            <h2>{currentUser.display_name || currentUser.full_name || "Your profile"}</h2>
            <p>Manage your photos, bio, and preferences.</p>
          </div>
          <Link href="/profile" className="wave-button">
            Edit profile <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    );
  }

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="DoorSmash home">
          <span className="brand-symbol" aria-hidden="true">d</span>
          <span>door<span>smash</span></span>
        </Link>
        <div className="sidebar-location">
          <span className="location-dot" />
          {currentUser.location || "LOS ANGELES, CA"}{" "}
          <span className="location-chevron">⌄</span>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-label">YOUR DATING LIFE</p>
          {(["Discover", "Matches", "Messages"] as Section[]).map((item) =>
            navButton(item),
          )}
        </nav>
        <div className="sidebar-date-promo">
          <span className="promo-spark" aria-hidden="true">✳</span>
          <p className="eyebrow">A LITTLE LESS SWIPING</p>
          <p>More making<br />a plan.</p>
          <button
            onClick={() => setSection("Discover")}
            type="button"
          >
            Find your person <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          {navButton("Profile")}
          <div className="signed-in">
            <span className="signed-avatar">
              {currentUser.display_name?.charAt(0) ||
                currentUser.full_name?.charAt(0) ||
                currentUser.email?.charAt(0) ||
                "U"}
            </span>
            <span>
              <strong>{currentUser.display_name || currentUser.full_name || "You"}</strong>
              <small>My profile</small>
            </span>
            <span className="more-dots" aria-hidden="true">•••</span>
          </div>
          <form action={signout}>
            <button className="text-link" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="mobile-header">
        <Link className="brand" href="/" aria-label="DoorSmash home">
          <span className="brand-symbol" aria-hidden="true">d</span>
          <span>door<span>smash</span></span>
        </Link>
        <button
          className="mobile-location"
          onClick={() => notify("Showing people near your location")}
          type="button"
        >
          <span className="location-dot" />
          {currentUser.location || "LA, CA"}{" "}
          <span aria-hidden="true">⌄</span>
        </button>
      </div>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>YOUR DATING LIFE</span>
            <span aria-hidden="true">/</span>
            <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-status">
              <span /> Your profile is live
            </span>
            {unreadNotifications > 0 && (
              <span className="topbar-status">
                <span aria-hidden="true">•</span>
                {unreadNotifications} notification{unreadNotifications > 1 ? "s" : ""}
              </span>
            )}
            <button
              className="help-button"
              onClick={() => notify("Need a hand? Safety and support are one tap away.")}
              type="button"
            >
              Help &amp; safety <span aria-hidden="true">↗</span>
            </button>
          </div>
        </header>
        {section === "Discover"
          ? renderDiscovery()
          : section === "Matches"
            ? renderMatches()
            : section === "Messages"
              ? renderMessages()
              : renderProfile()}
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {(["Discover", "Matches", "Messages", "Profile"] as Section[]).map((item) =>
          navButton(item, true),
        )}
      </nav>

      {overlay && (
        <div
          className="overlay-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOverlay(null);
          }}
        >
          {overlay === "match" && (
            <section
              className="modal-card match-modal"
              aria-labelledby="match-title"
              role="dialog"
              aria-modal="true"
            >
              <button
                className="modal-close"
                onClick={() => setOverlay(null)}
                type="button"
                aria-label="Close"
              >
                ×
              </button>
              <div className="match-confetti" aria-hidden="true">✳</div>
              <p className="eyebrow">WELL, THIS IS A GOOD START</p>
              <h2 id="match-title">It&apos;s a <em>match.</em></h2>
              <div className="match-duo">
                <span className="duo-photo you-photo">
                  {currentUser.display_name?.charAt(0) ||
                    currentUser.full_name?.charAt(0) ||
                    currentUser.email?.charAt(0) ||
                    "U"}
                </span>
                <span className="duo-heart" aria-hidden="true">♥</span>
                <span
                  className="duo-photo"
                  role="img"
                  aria-label={`Portrait of ${matchedProfile?.display_name || matchedProfile?.full_name}`}
                  style={{
                    backgroundImage: `url("${matchedProfile?.primary_photo_url || ""}")`,
                  }}
                />
              </div>
              <p className="modal-copy">
                You and {matchedProfile?.display_name || matchedProfile?.full_name || "them"} are both up for seeing where this goes. Make the first hello count.
              </p>
              <button
                className="smash-button modal-primary"
                onClick={() => {
                  setSection("Messages");
                  setOverlay("chat");
                  if (matches[0]?.conversation_id) {
                    void fetchConversationMessages(matches[0].conversation_id);
                  } else if (matches[0]) {
                    setCurrentMatch(matches[0]);
                  }
                }}
                type="button"
              >
                Send a hello <span aria-hidden="true">↗</span>
              </button>
              <button
                className="modal-secondary"
                onClick={() => setOverlay(null)}
                type="button"
              >
                Keep discovering
              </button>
            </section>
          )}
          {overlay === "chat" && (
            <section
              className="modal-card chat-modal"
              aria-labelledby="chat-title"
              role="dialog"
              aria-modal="true"
            >
              <div className="chat-header">
                <span
                  className="conversation-avatar large-avatar"
                  role="img"
                  aria-label={`Portrait of ${matchedProfile?.display_name || matchedProfile?.full_name}`}
                  style={{
                    backgroundImage: `url("${matchedProfile?.primary_photo_url || ""}")`,
                  }}
                />
                <div>
                  <p className="eyebrow">IT&apos;S A MATCH</p>
                  <h2 id="chat-title">{matchedProfile?.display_name || matchedProfile?.full_name || "Unknown"}</h2>
                </div>
                <button
                  className="modal-close inline-close"
                  onClick={() => setOverlay(null)}
                  type="button"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="chat-messages" ref={messagesEndRef}>
                <div className="chat-day">TODAY</div>
                {messages.map((text) => (
                  <p
                    className={`chat-bubble${
                      text.sender_id === user?.id ? " sent" : " received"
                    }`}
                    key={text.id}
                  >
                    {text.content}
                  </p>
                ))}
                {selectedDate.id > 0 && (
                  <button
                    className="chat-date-card"
                    onClick={() => setOverlay("schedule")}
                    type="button"
                  >
                    <span
                      className="date-card-image chat-date-image"
                      role="img"
                      aria-label={selectedDate.category.toLowerCase()}
                      style={{
                        backgroundImage: `url("${selectedDate.image_url || ""}")`,
                      }}
                    />
                    <span>
                      <span className="date-card-category">DATE CARD · {selectedDate.category}</span>
                      <strong>{selectedDate.title}</strong>
                      <small>{selectedDate.description || ""}</small>
                    </span>
                    <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>
              <form className="chat-compose" onSubmit={sendMessage}>
                <input
                  aria-label="Write a message"
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write something nice…"
                  value={message}
                />
                <button aria-label="Send message" type="submit" disabled={!message.trim()}>
                  Send <span aria-hidden="true">↗</span>
                </button>
              </form>
              <button
                className="schedule-inline chat-schedule"
                onClick={() => setOverlay("schedule")}
                type="button"
              >
                <span aria-hidden="true">✳</span> Suggest a date
              </button>
            </section>
          )}
          {overlay === "schedule" && (
            <section
              className="modal-card schedule-modal"
              aria-labelledby="schedule-title"
              role="dialog"
              aria-modal="true"
            >
              <button
                className="modal-close"
                onClick={() => setOverlay(null)}
                type="button"
                aria-label="Close"
              >
                ×
              </button>
              <p className="eyebrow">TAKE IT OFF THE APP</p>
              <h2 id="schedule-title">Make a <em>date.</em></h2>
              <p className="modal-copy">A clear plan makes saying yes easy. Keep your first meet somewhere public.</p>
              <div className="selected-date-summary">
                <span
                  className="date-card-image selected-date-image"
                  role="img"
                  aria-label={selectedDate.category.toLowerCase()}
                  style={{
                    backgroundImage: `url("${selectedDate.image_url || ""}")`,
                  }}
                />
                <span>
                  <span className="date-card-category">{selectedDate.category}</span>
                  <strong>{selectedDate.title}</strong>
                  <small>{selectedDate.description || ""}</small>
                </span>
              </div>
              <form className="schedule-form" onSubmit={proposeDate}>
                <label>
                  Date
                  <input
                    aria-label="Date"
                    min={new Date().toISOString().slice(0, 10)}
                    type="date"
                    required
                  />
                </label>
                <label>
                  Time
                  <select aria-label="Time" defaultValue="19:00">
                    <option value="18:15">6:15 pm</option>
                    <option value="19:00">7:00 pm</option>
                    <option value="20:00">8:00 pm</option>
                  </select>
                </label>
                <label className="note-label">
                  Add a note{" "}
                  <textarea
                    name="note"
                    placeholder="I&apos;ll grab us a table. Looking forward to it!"
                    rows={2}
                  />
                </label>
                <button
                  className="smash-button modal-primary"
                  type="submit"
                >
                  Send date idea <span aria-hidden="true">↗</span>
                </button>
              </form>
            </section>
          )}
        </div>
      )}
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </main>
  );
}
