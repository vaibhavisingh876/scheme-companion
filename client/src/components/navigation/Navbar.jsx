import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

const Navbar = ({ activeTab, onTabChange }) => {
  const { user, logout } = useContext(AuthContext);

  const handleAuthAction = () => {
    if (user?.loggedIn) {
      logout();
    } else {
      onTabChange("auth");
    }
  };

  return (
    <nav className="w-full bg-[#fdfbf7]/90 border-b border-[#d7ccc8] sticky top-0 z-50 backdrop-blur-md transition-all shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onTabChange("landing")}>
            <span className="text-lg font-black tracking-tight text-[#3e2723]">
              Scheme<span className="text-[#8d6e63] font-semibold">Companion</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <button onClick={() => onTabChange("landing")} className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "landing" ? "text-[#5d4037] bg-[#efebe9] font-black" : "text-[#8d6e63] hover:text-[#5d4037] hover:bg-[#f5f5f5]"}`}>
              Home
            </button>
            <button onClick={() => onTabChange("search")} className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "search" ? "text-[#5d4037] bg-[#efebe9] font-black" : "text-[#8d6e63] hover:text-[#5d4037] hover:bg-[#f5f5f5]"}`}>
              Find Schemes
            </button>
            <button onClick={() => onTabChange("saved")} className={`px-4 py-2.5 rounded-xl transition-all ${activeTab === "saved" ? "text-[#5d4037] bg-[#efebe9] font-black" : "text-[#8d6e63] hover:text-[#5d4037] hover:bg-[#f5f5f5]"}`}>
              Bookmarked Schemes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user?.loggedIn ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 bg-white border border-[#d7ccc8] px-3 py-1.5 rounded-full shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#efebe9] text-[#5d4037] flex items-center justify-center font-black text-[11px] uppercase">
                  {user.name.charAt(0)}
                </div>
                <span className="text-xs font-bold text-[#5d4037] hidden sm:inline pr-2">
                  {user.name}
                </span>
              </div>
              <button onClick={handleAuthAction} className="text-xs font-bold text-[#8d6e63] hover:text-[#5d4037] uppercase tracking-wider">
                Logout
              </button>
            </div>
          ) : (
            <button onClick={handleAuthAction} className="bg-[#5d4037] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#4e342e] shadow-md transition-all uppercase tracking-wider">
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;