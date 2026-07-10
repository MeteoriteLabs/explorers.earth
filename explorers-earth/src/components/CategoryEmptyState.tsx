import React from "react";
import { motion } from "framer-motion";
import Button from "./ui/Button";

interface SeededList {
  title: string;
  countLabel: string;
  images: string[];
  isPub: boolean;
}

interface CategorySeed {
  icon: string;
  label: string;
  lists: SeededList[];
}

const CATEGORY_SEEDS: Record<string, CategorySeed> = {
  places: {
    icon: "📍",
    label: "Places List",
    lists: [
      {
        title: "Tokyo Specialty Coffee Crawl",
        countLabel: "3 places",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Best Sushi in Tokyo",
        countLabel: "4 places",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1553621042-f6e147245754?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1563612116625-3012372fccbc?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  movies: {
    icon: "🎬",
    label: "Movies List",
    lists: [
      {
        title: "Sci-Fi Mind Benders",
        countLabel: "3 movies",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Cozy Animation Favorites",
        countLabel: "4 movies",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1448375240586-882707db888b?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  books: {
    icon: "📚",
    label: "Books List",
    lists: [
      {
        title: "Life-Changing Non-Fiction",
        countLabel: "3 books",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Epic Sci-Fi Reads",
        countLabel: "4 books",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1464802686167-b939a6910659?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  games: {
    icon: "🎮",
    label: "Games List",
    lists: [
      {
        title: "Immersive RPGs & Adventures",
        countLabel: "3 games",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1559893088-c0787ebfc084?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Cozy Casual Favorites",
        countLabel: "4 games",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  music: {
    icon: "🎵",
    label: "Music Playlist",
    lists: [
      {
        title: "Lofi Focus Soundtrack",
        countLabel: "3 tracks",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1535378917042-10a22c95931a?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1484755560695-a4c7300c5629?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Road Trip Classics",
        countLabel: "4 tracks",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  guides: {
    icon: "📖",
    label: "Guide",
    lists: [
      {
        title: "3-Day Kyoto Explorer",
        countLabel: "Itinerary",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1542044896530-05d85be9b11a?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Rome Historical Walk",
        countLabel: "Itinerary",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1529260830199-4455b9024f0a?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1515542690879-4b53b5b23b99?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  apps: {
    icon: "🛠️",
    label: "Apps List",
    lists: [
      {
        title: "Developer Essential Stack",
        countLabel: "4 apps & tools",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Minimalist Design Toolkit",
        countLabel: "3 apps & tools",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  products: {
    icon: "🛍️",
    label: "Products List",
    lists: [
      {
        title: "Digital Nomad EDC Setup",
        countLabel: "3 products",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1619134778706-7015533a6150?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Sleek Desk Setup Hardware",
        countLabel: "4 products",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
  people: {
    icon: "👥",
    label: "Persons List",
    lists: [
      {
        title: "Pioneers of Science Education",
        countLabel: "3 persons",
        isPub: false,
        images: [
          "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1532187643603-ba119ca4109e?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=80&h=80&fit=crop",
        ],
      },
      {
        title: "Inspiring Innovators",
        countLabel: "4 persons",
        isPub: true,
        images: [
          "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=80&h=80&fit=crop",
          "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=80&h=80&fit=crop",
        ],
      },
    ],
  },
};

const getCategoryAnimation = (category: string) => {
  switch (category) {
    case "places":
      return {
        animate: { y: [0, -4, 0] },
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
      };
    case "movies":
      return {
        animate: { rotate: [0, -10, 10, 0] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
      };
    case "books":
      return {
        animate: { y: [0, -3, 0] },
        transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      };
    case "games":
      return {
        animate: { rotate: [0, -6, 6, 0], x: [0, -1.5, 1.5, 0] },
        transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
      };
    case "music":
      return {
        animate: { scale: [1, 1.1, 1] },
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
      };
    case "guides":
      return {
        animate: { y: [0, -4, 0], rotate: [0, -2, 2, 0] },
        transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
      };
    case "apps":
      return {
        animate: { rotate: [0, -12, 12, 0] },
        transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
      };
    case "products":
      return {
        animate: { rotate: [0, -5, 5, 0] },
        transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
      };
    case "people":
      return {
        animate: { x: [-1.5, 1.5, -1.5] },
        transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
      };
    default:
      return {
        animate: { y: [0, -3, 0] },
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
      };
  }
};

interface CategoryEmptyStateProps {
  category: string;
  onAddClick: () => void;
}

export const CategoryEmptyState: React.FC<CategoryEmptyStateProps> = ({
  category,
  onAddClick,
}) => {
  const seed = CATEGORY_SEEDS[category] || CATEGORY_SEEDS.places;
  const animation = getCategoryAnimation(category) as any;

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8 bg-dashboard-sidebar/40 border border-dashboard rounded-3xl backdrop-blur-md transition-all duration-300 shadow-dashboard-elevated select-none">
      {/* Visual Header */}
      <div className="flex flex-col items-center text-center max-w-md mx-auto space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-dashboard-muted/20 border border-dashed border-dashboard flex items-center justify-center text-2xl shadow-inner text-white/50">
          <motion.span className="inline-block" {...animation}>
            {seed.icon}
          </motion.span>
        </div>
        <h3 className="text-base font-semibold text-white/80 font-poppins">
          No {seed.label.toLowerCase()}s created yet
        </h3>
        <p className="text-xs text-white/45 font-poppins leading-relaxed">
          Unlock your curator dashboard! Share your favorites by creating a list and building your curated collection.
        </p>
      </div>

      {/* Main Action Button */}
      <div className="flex justify-center">
        <Button
          btnText={`+ Create ${seed.label}`}
          variant="primary"
          size="small"
          onClickHandler={onAddClick}
          className="shadow-lg hover:shadow-dashboard-accent/20 transition-all duration-300 font-semibold animate-pulse-slow"
        />
      </div>

      {/* Structured Seeded Lists Previews Stack (Outlines / Blueprints Mode) */}
      <div className="flex flex-col gap-3.5">
        {seed.lists.map((list, index) => {
          const isPub = list.isPub;
          const statusColor = isPub ? "var(--status-pub)" : "var(--status-draft)";
          
          return (
            <motion.div
              key={index}
              className="relative group bg-white/[0.01] border border-dashed rounded-2xl p-4 flex items-center justify-between gap-4 cursor-default"
              animate={{
                boxShadow: [
                  "0 0 8px 1px rgba(255, 255, 255, 0.02)",
                  "0 0 20px 3px rgba(255, 255, 255, 0.08)",
                  "0 0 8px 1px rgba(255, 255, 255, 0.02)"
                ],
                borderColor: [
                  "rgba(255, 255, 255, 0.07)",
                  "rgba(255, 255, 255, 0.16)",
                  "rgba(255, 255, 255, 0.07)"
                ]
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 1.8
              }}
            >
              {/* Ghost Badge Overlay */}
              <span className="absolute top-2.5 right-3.5 text-[8px] font-bold uppercase tracking-wider text-white/35 bg-white/5 border border-dashed border-white/10 rounded-full px-2 py-0.5 font-poppins">
                Blueprint Preview
              </span>

              {/* Left Column: Avatar & Meta */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Dashed Circular Avatar Outline with animation */}
                <div className="flex-shrink-0">
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-xl bg-dashboard-muted/10 border-2 border-dashed text-white/30"
                    style={{ borderColor: statusColor }}
                  >
                    <motion.span className="inline-block" {...animation}>
                      {seed.icon}
                    </motion.span>
                  </div>
                </div>

                {/* Name, counts, and overlapping icons row */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white/60 truncate mb-1">
                    {list.title}
                  </h4>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                    <p className="text-[11px] text-white/35 truncate font-poppins">
                      {list.countLabel} · <span style={{ color: `${statusColor}` }}>{isPub ? "Template Published" : "Template Draft"}</span>
                    </p>

                    {/* Translucent Overlapping recommendations stack */}
                    <div className="flex -space-x-2.5 overflow-hidden items-center opacity-40 saturate-50 hover:opacity-65 hover:saturate-100 transition-all duration-300">
                      {list.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          className="inline-block h-5 w-5 rounded-full ring-2 ring-[var(--dash-sidebar-bg)] object-cover"
                          src={img}
                          alt="Blueprint item preview"
                          style={{ zIndex: 10 - imgIdx }}
                        />
                      ))}
                      <div
                        className="inline-block h-5 w-5 rounded-full ring-2 ring-[var(--dash-sidebar-bg)] bg-dashboard-muted/30 flex items-center justify-center text-[8px] text-white/30 font-bold font-poppins"
                        style={{ zIndex: 5 }}
                      >
                        +
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Ghost status badge (High readability white text) */}
              <div className="flex-shrink-0">
                <span 
                  className="font-poppins text-[10px] border border-dashed rounded-full px-2.5 py-1 font-bold text-white bg-white/[0.04]"
                  style={{ 
                    borderColor: statusColor, 
                  }}
                >
                  {isPub ? "Published" : "Draft"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
