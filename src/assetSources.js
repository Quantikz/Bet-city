// External CC0 asset catalog. Runtime models come from the original public repositories; no custom game geometry is used.
export const KENNEY_RAW = "https://raw.githubusercontent.com/shorepine/kenney/main/3d";
export const ASSETS = {
  buildings: ["city-commercial/building-a.glb","city-commercial/building-b.glb","city-commercial/building-c.glb","city-commercial/building-d.glb","city-commercial/building-e.glb","city-commercial/building-f.glb","city-commercial/building-g.glb","city-commercial/building-h.glb","city-commercial/building-i.glb","city-suburban/building-type-b.glb","city-suburban/building-type-c.glb","city-suburban/building-type-a.glb"],
  roads: { straight:"city-roads/road-straight.glb", crossing:"city-roads/road-crossing.glb", intersection:"city-roads/road-intersection.glb", sidewalk:"city-roads/road-side.glb", lamp:"city-roads/light-curved.glb" },
  cars: ["car/sedan.glb","car/sedan-sports.glb","car/taxi.glb","car/hatchback-sports.glb"],
  people: ["blocky-characters/character-a.glb","blocky-characters/character-b.glb","blocky-characters/character-c.glb","blocky-characters/character-d.glb","blocky-characters/character-e.glb","blocky-characters/character-f.glb"],
  interior: { counter:"furniture/kitchenBar.glb", chair:"furniture/chair.glb", stool:"furniture/stoolBar.glb", table:"furniture/table.glb", sofa:"furniture/loungeDesignSofa.glb", tv:"furniture/cabinetTelevision.glb", desk:"furniture/desk.glb", cabinet:"furniture/kitchenCabinet.glb", sideTable:"furniture/sideTable.glb" }
};
export const assetUrl = (path) => KENNEY_RAW + "/" + path;