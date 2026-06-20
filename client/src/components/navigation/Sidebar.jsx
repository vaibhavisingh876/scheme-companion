import React from "react";

const Sidebar = ({ activePage }) => {
  const menu = [
    { id: "overview", label: "Overview Insights", icon: "📊", link: "/dashboard/overview" },
    { id: "discover", label: "Scheme Discovery", icon: "✨", link: "/dashboard/discover" },
    { id: "saved", label: "Saved Portfolio", icon: "🔖", link: "/dashboard/saved" },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#faf9f6] border-r border-slate-200 flex flex-col min-h-screen shrink-0 z-20">
      <div className="p-6 border-b border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center font-black text-emerald-600 text-lg shadow-sm">
          Ω
        </div>
        <div>
          <h2 className="text-sm font-black tracking-wide text-slate-800">Companion</h2>
          <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Platform Hub</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 pt-6">
        {menu.map((item) => {
          const isActive = activePage === item.id;
          return (
            // Changed to anchor tag to open in new tab!
            <a
              key={item.id}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold tracking-wide transition-all group ${
                isActive
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              <span className={`text-lg transition-transform group-hover:scale-110 ${isActive ? "" : "opacity-80"}`}>
                {item.icon}
              </span>
              {item.label}
              <i className="fa-solid fa-arrow-up-right-from-square ml-auto text-[10px] opacity-40 group-hover:opacity-100"></i>
            </a>
          );
        })}
      </nav>

      <div className="p-5 border-t border-slate-200">
        <div className="bg-white border border-slate-100 p-4 rounded-2xl text-center shadow-sm">
          <p className="text-xs font-bold text-slate-500">Available Repository</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-400 h-full w-full" />
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">3,726 Records Ready</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;