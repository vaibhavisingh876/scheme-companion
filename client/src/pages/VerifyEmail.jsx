import { useEffect, useState } from "react";
import { verifyEmail } from "../services/api";

const VerifyEmail = () => {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    verifyEmail(token)
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setMessage(
            data.message ||
              "Email verified successfully! You can now log in."
          );
        } else {
          setStatus("error");
          setMessage(
            data.message ||
              "Verification failed."
          );
        }
      })
      .catch((err) => {
        setStatus("error");
        setMessage(
          err.response?.data?.message ||
            "Verification failed. The link may be expired."
        );
      });
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-5 py-10"
      style={{
        background: "var(--surface)",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-7 sm:p-9 text-center animate-fade-up"
        style={{
          background: "var(--panel)",
          border:
            "1px solid var(--border)",
          boxShadow:
            "0 16px 45px var(--shadow)",
        }}
      >
        {/* BRAND */}

        <div className="flex items-center justify-center gap-2 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-black"
            style={{
              background:
                "var(--saffron)",
            }}
          >
            SC
          </div>

          <span
            className="text-sm font-black"
            style={{
              fontFamily:
                "'Plus Jakarta Sans', sans-serif",
              color: "var(--ink)",
            }}
          >
            Scheme
            <span
              style={{
                color:
                  "var(--saffron)",
              }}
            >
              Companion
            </span>
          </span>
        </div>

        {/* LOADING */}

        {status === "loading" && (
          <div className="animate-fade-up">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{
                background:
                  "var(--saffron-lt)",
                border:
                  "1px solid var(--border)",
              }}
            >
              <div
                className="w-6 h-6 rounded-full animate-spin"
                style={{
                  border:
                    "2.5px solid var(--border)",
                  borderTopColor:
                    "var(--saffron)",
                }}
              />
            </div>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
              style={{
                color:
                  "var(--saffron)",
              }}
            >
              Please wait
            </p>

            <h2
              className="text-xl font-black"
              style={{
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
                color: "var(--ink)",
              }}
            >
              Verifying your email
            </h2>

            <p
              className="text-sm mt-2"
              style={{
                color:
                  "var(--muted)",
              }}
            >
              We're checking your verification
              link.
            </p>
          </div>
        )}

        {/* SUCCESS */}

        {status === "success" && (
          <div className="animate-fade-up">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-xl"
              style={{
                background:
                  "var(--green-lt)",
                border:
                  "1px solid #C3E6D0",
              }}
            >
              ✓
            </div>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
              style={{
                color:
                  "var(--green)",
              }}
            >
              Verification complete
            </p>

            <h2
              className="text-2xl font-black"
              style={{
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
                color: "var(--ink)",
              }}
            >
              Email verified
            </h2>

            <p
              className="text-sm mt-3 leading-6"
              style={{
                color:
                  "var(--muted)",
              }}
            >
              {message}
            </p>

            <a
              href="/?page=auth"
              className="inline-flex items-center justify-center mt-7 px-6 py-3 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
              style={{
                background:
                  "var(--saffron)",
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
                boxShadow:
                  "0 7px 20px rgba(224,123,57,0.18)",
              }}
            >
              Go to Login →
            </a>
          </div>
        )}

        {/* ERROR */}

        {status === "error" && (
          <div className="animate-fade-up">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 text-xl"
              style={{
                background:
                  "var(--red-lt)",
                border:
                  "1px solid #F5C6C2",
              }}
            >
              !
            </div>

            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
              style={{
                color:
                  "var(--red)",
              }}
            >
              Something went wrong
            </p>

            <h2
              className="text-2xl font-black"
              style={{
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
                color: "var(--ink)",
              }}
            >
              Verification failed
            </h2>

            <p
              className="text-sm mt-3 leading-6"
              style={{
                color:
                  "var(--muted)",
              }}
            >
              {message}
            </p>

            <a
              href="/?page=auth"
              className="inline-flex items-center justify-center mt-7 px-6 py-3 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
              style={{
                background:
                  "var(--saffron)",
                fontFamily:
                  "'Plus Jakarta Sans', sans-serif",
              }}
            >
              Back to Login →
            </a>
          </div>
        )}

        <div
          className="mt-8 pt-5"
          style={{
            borderTop:
              "1px solid var(--border)",
          }}
        >
          <p
            className="text-[10px]"
            style={{
              color:
                "var(--muted)",
            }}
          >
            Scheme Companion · AI welfare discovery
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

