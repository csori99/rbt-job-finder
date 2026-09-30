export const CENTERS = { miami: [25.7617, -80.1918], davie: [26.0629, -80.2331] }

const CITIES = {
  'miami beach': [25.7907, -80.13], 'north miami beach': [25.9331, -80.1625], 'north miami': [25.8901, -80.1867],
  'south miami heights': [25.5976, -80.3809], 'south miami': [25.7076, -80.2934], 'west miami': [25.7587, -80.2978],
  'miami gardens': [25.942, -80.2456], 'miami lakes': [25.9087, -80.3087], 'miami springs': [25.8223, -80.2895],
  'miami shores': [25.863, -80.1928], hialeah: [25.8576, -80.2781], doral: [25.8195, -80.3553],
  kendall: [25.6793, -80.3173], homestead: [25.4687, -80.4776], 'florida city': [25.4479, -80.4792],
  'coral gables': [25.7215, -80.2684], aventura: [25.9565, -80.1392], 'cutler bay': [25.5808, -80.3468],
  'palmetto bay': [25.6217, -80.3248], pinecrest: [25.6671, -80.3081], sweetwater: [25.7634, -80.3731],
  westchester: [25.7548, -80.3273], tamiami: [25.7587, -80.3981], 'the hammocks': [25.6715, -80.4445],
  hammocks: [25.6715, -80.4445], 'country walk': [25.6334, -80.4323], 'richmond heights': [25.6315, -80.3689],
  princeton: [25.5384, -80.4089], medley: [25.8407, -80.3264], 'opa-locka': [25.9023, -80.2503],
  'sunny isles': [25.9429, -80.1234], surfside: [25.8784, -80.1256], 'key biscayne': [25.6937, -80.1628],
  'biscayne park': [25.8826, -80.1809], 'bal harbour': [25.8918, -80.1267], 'coconut grove': [25.7126, -80.2573],
  brickell: [25.7589, -80.1937], 'kendale lakes': [25.7082, -80.407], 'olympia heights': [25.7243, -80.3395],
  fontainebleau: [25.7729, -80.3478], 'hialeah gardens': [25.8651, -80.3245], goulds: [25.5626, -80.3823],
  'fort lauderdale': [26.1224, -80.1373], 'ft lauderdale': [26.1224, -80.1373], hollywood: [26.0112, -80.1495],
  'pembroke pines': [26.0078, -80.2963], miramar: [25.9861, -80.3036], davie: [26.0629, -80.2331],
  plantation: [26.1276, -80.2331], sunrise: [26.1669, -80.2564], weston: [26.1004, -80.3998],
  'coral springs': [26.2712, -80.2706], 'pompano beach': [26.2379, -80.1248], hallandale: [25.9812, -80.1484],
  dania: [26.0523, -80.1439], 'cooper city': [26.0573, -80.2717], tamarac: [26.2129, -80.2498],
  lauderhill: [26.1404, -80.2134], 'lauderdale lakes': [26.1665, -80.2081], margate: [26.2445, -80.2064],
  'coconut creek': [26.2517, -80.1789], 'deerfield beach': [26.3184, -80.0998], 'southwest ranches': [26.0587, -80.3372],
  'west park': [25.9845, -80.1987], 'oakland park': [26.1723, -80.132], 'wilton manors': [26.1604, -80.1389],
  parkland: [26.3101, -80.2373], 'north lauderdale': [26.2173, -80.2259], 'lighthouse point': [26.2756, -80.0873],
  miami: [25.7617, -80.1918],
}
const NAMES = Object.keys(CITIES).sort((a, b) => b.length - a.length)

export function miles([a, b], [c, d]) {
  const r = (x) => (x * Math.PI) / 180
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

export function locate(location = '', geo) {
  let pt = geo ? [geo.lat, geo.lng] : null
  if (!pt) {
    const l = location.toLowerCase()
    const name = NAMES.find((n) => l.includes(n))
    if (name) pt = CITIES[name]
  }
  if (!pt) return { fromMiami: null, fromDavie: null }
  return {
    fromMiami: Math.round(miles(pt, CENTERS.miami)),
    fromDavie: Math.round(miles(pt, CENTERS.davie)),
  }
}
