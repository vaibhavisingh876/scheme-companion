
import RecommendationCard from "../components/RecommendationCard.jsx";

const SavedSchemes = ({
  savedList = [],
  onRemoveScheme,
  onViewDetails,
}) => {
  const activeList = Array.isArray(savedList)
    ? savedList
    : [];

  return (
    <div className="relative min-h-[calc(100vh-68px)] overflow-hidden">
      {/* BACKGROUND */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 85% 8%, rgba(224,123,57,0.10), transparent 28%), radial-gradient(circle at 5% 45%, rgba(224,123,57,0.05), transparent 25%)",
        }}
      />

      <div
        className="absolute top-0 right-0 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(224,123,57,0.07), transparent 68%)",
          filter: "blur(30px)",
        }}
      />

      {/* PAGE */}
      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10 md:py-14">

        {/* =================================================
            HERO HEADER
        ================================================= */}
        <section className="mb-12">
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">

            <div className="animate-fade-up">
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-8 h-px"
                  style={{
                    background:
                      "var(--saffron)",
                  }}
                />

                <span
                  className="text-[10px] font-black uppercase tracking-[0.22em]"
                  style={{
                    color:
                      "var(--saffron)",
                  }}
                >
                  Your collection
                </span>
              </div>

              <h1
                className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05]"
                style={{
                  fontFamily:
                    "'Plus Jakarta Sans', sans-serif",
                  color: "var(--ink)",
                }}
              >
                Schemes worth
                <br />

                <span
                  style={{
                    color:
                      "var(--saffron)",
                  }}
                >
                  remembering.
                </span>
              </h1>

              <p
                className="text-sm md:text-base mt-5 max-w-xl leading-7"
                style={{
                  color: "var(--muted)",
                }}
              >
                Keep the government schemes that
                matter to you in one place. Come back
                whenever you're ready to explore them.
              </p>
            </div>

            {/* SAVED COUNT */}
            <div
              className="animate-fade-up stagger-2 premium-card rounded-3xl px-6 py-5 min-w-[190px]"
            >
              <div className="flex items-center justify-between gap-5">
                <div>
                  <p
                    className="text-[9px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      color: "var(--muted)",
                    }}
                  >
                    Saved schemes
                  </p>

                  <p
                    className="text-4xl font-black mt-1"
                    style={{
                      fontFamily:
                        "'JetBrains Mono', monospace",
                      color:
                        "var(--saffron)",
                    }}
                  >
                    {String(activeList.length).padStart(
                      2,
                      "0"
                    )}
                  </p>
                </div>

                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                  style={{
                    background:
                      "var(--saffron-lt)",
                    border:
                      "1px solid var(--border)",
                  }}
                >
                  🔖
                </div>
              </div>
            </div>
          </div>

          {/* DECORATIVE LINE */}
          <div
            className="mt-9 h-px w-full"
            style={{
              background:
                "linear-gradient(90deg, var(--saffron), var(--border), transparent)",
            }}
          />
        </section>

        {/* =================================================
            EMPTY STATE
        ================================================= */}
        {activeList.length === 0 ? (
          <section className="animate-fade-up">
            <div
              className="relative rounded-[32px] overflow-hidden px-6 py-20 md:py-24 text-center"
              style={{
                background: "var(--panel)",
                border:
                  "1px solid var(--border)",
                boxShadow:
                  "var(--shadow-soft)",
              }}
            >
              {/* Glow */}
              <div
                className="absolute w-72 h-72 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(224,123,57,0.10), transparent 68%)",
                  filter: "blur(15px)",
                }}
              />

              <div className="relative">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-7 text-3xl animate-float"
                  style={{
                    background:
                      "var(--saffron-lt)",
                    border:
                      "1px solid var(--border)",
                    boxShadow:
                      "0 12px 35px rgba(224,123,57,0.10)",
                  }}
                >
                  🔖
                </div>

                <p
                  className="text-[10px] font-black uppercase tracking-[0.22em] mb-3"
                  style={{
                    color:
                      "var(--saffron)",
                  }}
                >
                  Nothing saved yet
                </p>

                <h2
                  className="text-2xl md:text-3xl font-black tracking-tight"
                  style={{
                    fontFamily:
                      "'Plus Jakarta Sans', sans-serif",
                    color: "var(--ink)",
                  }}
                >
                  Your shortlist is waiting.
                </h2>

                <p
                  className="text-sm leading-6 max-w-md mx-auto mt-3"
                  style={{
                    color: "var(--muted)",
                  }}
                >
                  Find schemes that match your profile
                  and save the ones you want to come back
                  to later.
                </p>

                <div className="mt-7">
                  <span
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black"
                    style={{
                      background:
                        "var(--saffron)",
                      color: "#fff",
                      fontFamily:
                        "'Plus Jakarta Sans', sans-serif",
                      boxShadow:
                        "0 8px 25px rgba(224,123,57,0.18)",
                    }}
                  >
                    Go to Find Schemes
                    <span>→</span>
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* =================================================
                COLLECTION LABEL
            ================================================= */}
            <div
              className="flex items-center justify-between mb-5 animate-fade-up stagger-2"
            >
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.18em]"
                  style={{
                    color:
                      "var(--muted)",
                  }}
                >
                  Your shortlist
                </p>

                <p
                  className="text-sm font-bold mt-1"
                  style={{
                    color:
                      "var(--ink)",
                  }}
                >
                  {activeList.length}{" "}
                  {activeList.length === 1
                    ? "scheme"
                    : "schemes"}{" "}
                  saved
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full animate-blink"
                  style={{
                    background:
                      "var(--saffron)",
                  }}
                />

                <span
                  className="text-[9px] font-bold uppercase tracking-widest"
                  style={{
                    color:
                      "var(--muted)",
                  }}
                >
                  Your collection
                </span>
              </div>
            </div>

            {/* =================================================
                CARDS
            ================================================= */}
            <div className="grid md:grid-cols-2 gap-6">
              {activeList.map(
                (scheme, idx) => (
                  <div
                    key={`${scheme.id}-${idx}`}
                    className="group animate-fade-up"
                    style={{
                      animationDelay: `${
                        0.08 + idx * 0.07
                      }s`,
                    }}
                  >
                    <RecommendationCard
                      scheme={scheme}
                      onViewDetails={
                        onViewDetails
                      }
                    />

                    {/* REMOVE ACTION */}
                    <div className="flex justify-between items-center px-2 pt-2.5">
                      <span
                        className="text-[9px] uppercase tracking-widest font-semibold"
                        style={{
                          color:
                            "var(--muted)",
                        }}
                      >
                        Saved to bookmarks
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          onRemoveScheme(
                            scheme.id
                          )
                        }
                        className="group/remove inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg transition-all duration-200"
                        style={{
                          color:
                            "var(--muted)",
                          border:
                            "1px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color =
                            "var(--red)";
                          e.currentTarget.style.background =
                            "var(--red-lt)";
                          e.currentTarget.style.borderColor =
                            "var(--red)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color =
                            "var(--muted)";
                          e.currentTarget.style.background =
                            "transparent";
                          e.currentTarget.style.borderColor =
                            "transparent";
                        }}
                      >
                        <span>×</span>
                        Remove
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SavedSchemes;

