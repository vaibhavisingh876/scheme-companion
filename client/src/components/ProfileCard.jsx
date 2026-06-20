import React from "react";

const ProfileCard = ({ profile }) => {
  if (!profile) return null;

  const capitalizeString = (str) => {
    if (!str) return "N/A";
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
  };

  return (
    <div className="relative overflow-hidden bg-[#faf6f0] border border-[#d7ccc8] rounded-3xl p-6 shadow-xl shadow-[#d7ccc8]/40 backdrop-blur-md mb-8">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#efebe9] blur-3xl rounded-full pointer-events-none" />
      
      <div className="flex items-center gap-2.5 mb-5 relative z-10">
        <span className="flex w-2.5 h-2.5 rounded-full bg-[#8d6e63] animate-pulse" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-[#5d4037]">
          Normalized Processing Schema State
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-6 relative z-10">
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Age Parameter</p>
          <p className="text-sm font-semibold text-[#3e2723]">{profile.age || "Not Specified"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Gender Context</p>
          <p className="text-sm font-semibold text-[#3e2723]">{capitalizeString(profile.gender)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Identity Focus</p>
          <p className="text-sm font-semibold text-[#3e2723]">{capitalizeString(profile.occupation)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Territorial State</p>
          <p className="text-sm font-semibold text-[#3e2723]">{profile.state || "All India Scope"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Economic Cap</p>
          <p className="text-sm font-semibold text-[#3e2723]">
            {profile.income ? `₹${Number(profile.income).toLocaleString()}` : "No Limit Criteria"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-[#8d6e63] font-bold uppercase tracking-wider">Academic Level</p>
          <p className="text-sm font-semibold text-[#3e2723]">{capitalizeString(profile.educationLevel)}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;