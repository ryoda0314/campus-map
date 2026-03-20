// Campus registry — add new campuses here
// Each campus module must export: CAMPUS, SPOTS, SPOT_CATS, AREAS, ENTRANCES, WAYPOINTS, EDGES

const campusLoaders = {
  ookayama: () => import("./ookayama.js"),
  kasei_itabashi: () => import("./kasei_itabashi.js"),
  // suzukake: () => import("./suzukake.js"),
  // tamachi:  () => import("./tamachi.js"),
};

// Static metadata for campus selection page (no need to load full data)
export const CAMPUS_LIST = [
  {
    id: "ookayama",
    name: "東京科学大学 大岡山キャンパス",
    shortName: "大岡山",
    university: "東京科学大学",
    center: { lat: 35.6048, lng: 139.6835 },
  },
  {
    id: "kasei_itabashi",
    name: "東京家政大学 板橋キャンパス",
    shortName: "板橋",
    university: "東京家政大学",
    center: { lat: 35.75520, lng: 139.72130 },
  },
  // Add more campuses here:
  // {
  //   id: "suzukake",
  //   name: "東京科学大学 すずかけ台キャンパス",
  //   shortName: "すずかけ台",
  //   university: "東京科学大学",
  //   center: { lat: 35.5133, lng: 139.4817 },
  // },
];

export async function loadCampusData(campusId) {
  const loader = campusLoaders[campusId];
  if (!loader) return null;
  const mod = await loader();
  return {
    CAMPUS: mod.CAMPUS,
    SPOTS: mod.SPOTS,
    SPOT_CATS: mod.SPOT_CATS,
    AREAS: mod.AREAS,
    ENTRANCES: mod.ENTRANCES,
    WAYPOINTS: mod.WAYPOINTS,
    EDGES: mod.EDGES,
    getSpot: mod.getSpot,
  };
}

export function getCampusIds() {
  return Object.keys(campusLoaders);
}
