const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
  ? 'http://localhost:3000'
  : 'https://camino2.onrender.com';

const SESSION_SIZE = 20;           // 20 rues / monuments par session
const MAX_ERRORS_MARATHON = 3;     // 3 erreurs max en mode "marathon"
const MAX_TIME_SECONDS = 500;      // coupe les chronos à 500 s (sécurité)
const CHRONO_DURATION = 60;        // mode chrono : 60 secondes
const HIGHLIGHT_DURATION_MS = 5000 // 5 secondes
const MAX_POINTS_PER_ITEM = 10;

// ── Sound Engine (Web Audio API) ──
let soundEnabled = localStorage.getItem('camino-sound') !== 'off';
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type, volume, delay) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume || 0.15, ctx.currentTime + (delay || 0));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (delay || 0) + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + (delay || 0));
    osc.stop(ctx.currentTime + (delay || 0) + duration);
  } catch (e) { /* audio not supported */ }
}

function playDing() {
  playTone(880, 0.15, 'sine', 0.12, 0);
  playTone(1320, 0.2, 'sine', 0.1, 0.1);
}

function playBuzz() {
  playTone(150, 0.25, 'sawtooth', 0.08, 0);
  playTone(120, 0.3, 'square', 0.05, 0.05);
}

function playVictory() {
  playTone(523, 0.15, 'sine', 0.12, 0);      // C
  playTone(659, 0.15, 'sine', 0.12, 0.15);   // E
  playTone(784, 0.15, 'sine', 0.12, 0.30);   // G
  playTone(1047, 0.3, 'triangle', 0.1, 0.45); // C+
}

function playTick() {
  playTone(1000, 0.03, 'square', 0.04, 0);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('camino-sound', soundEnabled ? 'on' : 'off');
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
  if (soundEnabled) playDing(); // feedback
}

// Infos historiques / descriptives pour les rues célèbres

const FAMOUS_STREET_INFOS = {
  'la canebière': "Avenue née entre 1666 et 1672 lors de l’agrandissement de Louis XIV, la Canebière — nommée d’après le chanvre (canebe) — s’étend sur près d’un kilomètre du Vieux-Port aux Réformés, intégrant depuis 1927 Noailles et les allées de Meilhan. Élargie au XIXᵉ siècle et structurée autour d’édifices comme le Palais de la Bourse, elle reste un repère historique et architectural majeur de Marseille.",
  'quai du port': "Bordant la rive nord du Vieux-Port, le Quai du Port abrite l’Hôtel de Ville (XVIIᵉ siècle) et fut en grande partie reconstruit par Fernand Pouillon après les dynamitages de 1943. Axe historique du pouvoir municipal et du commerce maritime, il est aujourd'hui une vaste esplanade piétonne offrant une vue emblématique sur Notre-Dame de la Garde.",
  'rue de la république': "Ouverte en 1864 sous le nom de « rue Impériale » pour relier le Vieux-Port à la Joliette, elle a supprimé 935 maisons et 61 rues au profit d’un tracé haussmannien. Rebaptisée « rue de la République » après la chute du Second Empire, elle demeure l’un des marqueurs urbains et historiques majeurs de Marseille.",
  'quai des belges': "Situé sur le front est du Vieux-Port, le Quai des Belges a vu son rôle évoluer après l’ouverture du tunnel du Vieux-Port en 1967. Rebaptisé en 2013 et réaménagé la même année en vaste esplanade piétonne avec l’Ombrière de Norman Foster, il demeure un repère historique central de Marseille.",
  'quai de rive-neuve': "Situé sur la rive sud du Vieux-Port, ce quai fut aménagé dès le XVIᵉ siècle pour accueillir les chantiers navals et l'Arsenal des Galères. Marqué par des édifices comme la Criée (devenu théâtre) et les anciens entrepôts de la douane, il constitue aujourd'hui un pôle touristique et culturel majeur reliant le centre-ville au quartier de Saint-Victor.",
  'rue paradis': "Issue d’un premier tracé ouvert vers 1666 sous Louis XIV puis prolongée jusqu’en 1880, la rue Paradis relie aujourd’hui la place du Général-de-Gaulle à l’avenue du Prado sur près de 2,9 km, faisant d’elle l’une des plus longues voies de Marseille. Son nom vient d’un ancien prieuré médiéval, et elle s’est affirmée comme un axe résidentiel et bourgeois marqué par ses hôtels particuliers, ses façades soignées et l’église Saint-Joseph.",
  'corniche du président john fitzgerald kennedy': "Aménagée comme chemin côtier entre 1848 et 1863 puis élargie en boulevard panoramique entre 1954 et 1968, la corniche du Président-John-Fitzgerald-Kennedy longe la Méditerranée sur 3,7 km, des Catalans aux plages du Prado. Rebaptisée en 1963, elle est bordée de villas du XIXᵉ siècle, de plages et de restaurants, et offre l’un des panoramas maritimes emblématiques de Marseille.",
  'avenue du prado': "Aménagée au XIXᵉ siècle pour prolonger l’axe central de la ville jusqu’aux plages, l’avenue du Prado — ancien « boulevard du Sud » — a transformé les terrains marécageux du sud de Marseille en un vaste corridor urbain de 60 m de large, planté d’arbres. Bordée d’immeubles anciens, de commerces et d’équipements majeurs, elle demeure l’un des grands axes structurants de la ville.",
  'place du général de gaulle': "Aménagée vers 1778 après la démolition de l’arsenal des galères, la place du Général-de-Gaulle — longtemps connue sous divers noms — occupe un carrefour central entre la Canebière, la rue Paradis et le palais de la Bourse. Des vestiges antiques de salines et de quais y témoignent d’une activité portuaire très ancienne, renforçant son rôle de repère historique et urbain majeur.",
  'boulevard michelet': "S’étendant sur 2,5 km du rond-point du Prado à l’obélisque de Mazargues, le boulevard Michelet constitue l’un des grands axes sud de Marseille. Bordé de repères majeurs — Cité radieuse de Le Corbusier, stade Vélodrome, bastides anciennes — il articule architecture moderne et patrimoine historique dans un même corridor urbain.",
  'boulevard rabatau': "Du rond-point du Prado à la place de Pologne, le boulevard Rabatau structure le sud-est de Marseille, longeant le parc Chanot et l’hôpital Saint-Joseph. Partiellement intégré à la rocade du Jarret, il est en requalification depuis 2022 avec trottoirs élargis, pistes cyclables et végétalisation.",
  'route de la gineste': "Portion sinueuse de la RD 559, la route de la Gineste relie Marseille à Cassis en traversant le massif des Calanques sur près de 10 km. Aménagée dès le XIXᵉ siècle pour le passage des troupes et du commerce, elle s'élève jusqu'au col de la Gineste, offrant un itinéraire paysager exceptionnel entre mer et garrigue, marqué par son caractère sauvage et escarpé.",
  'allée léon gambetta': "Ouverte au public en 1775 sous le nom de « Cours des Capucines », l’allée Léon-Gambetta relie la place des Capucines au square Stalingrad en plein centre de Marseille. Rebaptisée en 1920 en hommage à Gambetta, elle a accueilli tram puis bus et demeure une traversée urbaine historique du 1ᵉʳ arrondissement.",
  'boulevard de la corderie': "Ouvert en 1860, le boulevard de la Corderie — long de 467 m et nommé d’après les anciennes corderies du quartier Saint-Victor — relie la place éponyme à la rue d’Endoume. Il abrite la carrière antique de la Corderie, site d’extraction grec puis romain aujourd’hui classé, qui en fait un lieu marqué par l’histoire industrielle et urbaine de Marseille.",
  'cours pierre puget': "Tracé en 1800 sous le nom de « cours Bonaparte », le cours Pierre-Puget relie la place Estrangin-Pastré à la colline Puget et s’orne d’immeubles haussmanniens ainsi que du palais de justice voisin, implanté à la fin du XIXᵉ siècle. Une statue de Pierre Puget, installée en 1906, renforce son ancrage dans l’histoire artistique et urbaine marseillaise.",
  'rue saint-ferréol': "Ouverte en 1693 lors de l’agrandissement de Marseille sous Louis XIV, la rue Saint-Ferréol relie aujourd’hui la place Félix-Baret à la Canebière. Bordée d’immeubles de l’Ancien Régime et du XIXᵉ siècle, elle constitue l’une des principales artères piétonnes et commerçantes historiques de la ville.",
  'rue de rome': "Ouverte après l’agrandissement de Marseille sous Louis XIV et prolongée en 1774 jusqu’à Castellane, la rue de Rome est devenue l’un des grands axes du centre-ville, long d’environ 1,2 km. Marquée par des immeubles anciens et des repères patrimoniaux comme la maison de Pierre Puget, elle a été requalifiée en 2015 avec l’arrivée du tramway et l’élargissement des trottoirs.",
  'cours lieutaud': "Ouvert en 1864 pour relier le sud de Marseille au boulevard Garibaldi, le Cours Lieutaud adopte un tracé aménagé sous un talus, dominé par le pont de la rue d’Aubagne, et bordé d’immeubles haussmanniens du XIXᵉ siècle. Requalifié entre 2019 et 2021, il a été apaisé par l’élargissement des trottoirs, les pistes cyclables et la réduction de la circulation.",
  'place castellane': "Créée en 1774, la place Castellane est devenue un carrefour majeur du centre-sud de Marseille, à la jonction de la rue de Rome, du Prado et du boulevard Baille. Au centre se dresse depuis 1913 la Fontaine Cantini, œuvre en marbre de Carrare représentant trois fleuves provençaux, qui a remplacé l’obélisque de 1811 et constitue aujourd’hui l’un de ses marqueurs emblématiques.",
  'boulevard baille': "Ouvert au public entre 1857 et 1861 à partir d’un ancien cul-de-sac privé, le boulevard Baille relie Castellane au boulevard Jean-Moulin sur 1,3 km. Bordé de commerces, d’habitations et d’équipements hospitaliers, il est devenu un axe structurant des 5ᵉ et 6ᵉ arrondissements.",
  'boulevard chave': "Percé dès 1830 et structuré en 1841, le boulevard Chave relie La Plaine à la gare de la Blancarde sur environ 1,5 km, formant l’axe central du Camas. Urbanisé selon le lotissement conçu par les frères André et Nicolas-Henri Chave, avec ses « immeubles trois fenêtres » du XIXᵉ siècle, il est desservi par le tramway depuis 1893 et demeure un repère résidentiel majeur.",
  'boulevard longchamp': "Tracé à partir de 1839 pour relier la ville au Palais Longchamp, ce boulevard majestueux est bordé d'hôtels particuliers et d'immeubles de style Second Empire. Long d'environ 600 m, il a conservé son caractère aristocratique et paysager, accentué par la circulation du tramway et la perspective monumentale qu'il offre sur le château d'eau et le muséum d'histoire naturelle.",
  "boulevard d'athènes": "Long de 227 m entre la place des Capucines et la place des Marseillaises, le boulevard d’Athènes prolonge Dugommier et débouche sur l’escalier monumental de la gare Saint-Charles. Ouvert sous Delacroix et achevé sous Thibaudeau, il concentre quelques bâtiments marquants et sert de liaison centrale entre gare, centre-ville et quartiers nord-est.",
  'rue de lodi': "Longue d’environ 640 m dans le 6ᵉ arrondissement, la rue de Lodi — ancien « chemin de Briquet » rebaptisée en 1796 — relie Notre-Dame-du-Mont à la rue Sainte-Cécile. Elle a accueilli l’hôpital militaire Michel-Lévy jusqu’en 1988 et conserve des repères comme l’église Notre-Dame-du-Mont.",
  'cours julien': "Aménagé au XIXᵉ siècle sur les anciennes lices de l’enceinte démolie, le Cours Julien devint dès 1860 le centre du commerce de gros marseillais, accueillant le marché central jusqu’en 1972. Ses entrepôts réaffectés ont ensuite façonné un quartier culturel et artistique majeur, aujourd’hui marqué par le street-art, les cafés et les lieux indépendants.",
  'place notre-dame du mont': "Située à la jonction du Cours Julien et de la rue de Lodi, cette place tire son nom de l'église paroissiale reconstruite au XIXᵉ siècle sur un site religieux plus ancien. Quartier historique des maraîchers, elle est devenue un centre de vie nocturne et bohème, structuré autour de ses terrasses de cafés et de sa fontaine centrale, cœur battant du 6ᵉ arrondissement.",
  'place jean jaurès': "Établie sur un ancien plateau médiéval servant de camp, de champ de manœuvres et de lieu de foires, la place Jean-Jaurès — dite « La Plaine » — s’est affirmée dès le XIXᵉ siècle comme grand marché populaire. Rebaptisée en 1919 en hommage à Jean Jaurès, elle demeure un repère historique et social majeur de Marseille.",
  'boulevard sakakini': "Partie intégrante de la rocade du Jarret, le boulevard Sakakini fut aménagé après la couverture de la rivière entre 1954 et 1968 pour relier les quartiers est. Long d'environ 1 km entre Chave et la Blancarde, il porte le nom du résistant Jean-Marius Sakakini et constitue un axe routier dense, bordé d'immeubles modernes et d'équipements structurants.",
  'rue du camas': "Axe central du quartier éponyme dans le 5ᵉ arrondissement, la rue du Camas fut urbanisée au milieu du XIXᵉ siècle suite aux grands lotissements bourgeois. Longue de 600 m, elle est bordée de façades typiques marseillaises et relie la rue de Lodi au boulevard Chave, incarnant l'identité d'un quartier de faubourg paisible et commerçant.",
  'boulevard de la libération – général de monsabert': "Prolongement de la Canebière jusqu’aux Cinq-Avenues, le boulevard de la Libération — ancien boulevard de la Madeleine — traverse les 1ᵉʳ, 4ᵉ et 5ᵉ arrondissements. Rebaptisé après 1944 en hommage à la libération de Marseille et au général de Monsabert, il demeure une artère commerçante et mémorielle structurante du centre-est de la ville.",
  'boulevard des dames': "Boulevard ouvert à partir de 1812 sur l’ancien tracé des remparts nord et prolongé dans les années 1860 vers la Joliette, il porte un nom honorant les femmes ayant défendu Marseille en 1524. Structurant le secteur des Grands-Carmes, il a révélé en 2022 un vestige de rempart du XVIIᵉ siècle.",
  'place de lenche': "Considérée comme la plus ancienne place de Marseille, la place de Lenche occupe probablement l’emplacement de l’agora de Massalia. Elle doit son nom à la famille corse Lenche, qui y possédait au XVIᵉ siècle un hôtel particulier abritant aujourd’hui le théâtre du même nom. Ancien site de couvent puis de fonderie royale, elle forme aujourd’hui un carrefour vivant du Panier avec vue sur la mer.",
  'rue du panier': "Artère emblématique du plus vieux quartier de Marseille, la rue du Panier suit un tracé sinueux et étroit hérité de l'époque grecque et médiévale. Elle tire son nom d'une ancienne auberge à l'enseigne « Le Panier » et constitue aujourd'hui le cœur touristique de la vieille ville, bordée de maisons colorées, de galeries d'art et de petits commerces de proximité.",
  'place de la major': "Vaste esplanade située entre le Vieux-Port et la Joliette, elle est dominée par la cathédrale Sainte-Marie-Majeure, édifice romano-byzantin monumental du XIXᵉ siècle. Réaménagée dans le cadre d'Euroméditerranée, elle surplombe les Voûtes de la Major et offre une ouverture architecturale majeure sur le large et le nouveau quartier du Mucem.",
  'place de la joliette': "Aménagée au XIXᵉ siècle lors de la création du nouveau port autonome, la place de la Joliette est le pivot du quartier maritime de Marseille. Dominée par les docks historiques et le FRAC, elle constitue le centre nerveux d'Euroméditerranée, reliant les activités portuaires, le centre d'affaires et les grandes lignes de transport urbain.",
  'place bernard cadenat': "Cœur battant du quartier de la Belle de Mai, cette place porte le nom d'un ancien député-maire socialiste de Marseille. Ancienne place des Écoles, elle accueille quotidiennement un marché populaire et reste le symbole de l'identité ouvrière et multiculturelle du 3ᵉ arrondissement, structurée autour de ses commerces et de son église.",
  'cours belsunce': "Ouvert en 1670 sur les anciennes lices de la ville, le cours Belsunce — nommé en hommage à l’évêque Belsunce, figure de la peste de 1720 — fut l’une des grandes places baroques de Marseille avant de perdre son unité architecturale avec les percements de la fin du XIXᵉ siècle. Remplacé en partie par les tours Labourdette et des constructions modernes, il accueille le théâtre de l’Alcazar reconverti aujourd’hui en bibliothèque et incarne le basculement d’un ancien espace aristocratique vers un quartier populaire dense et traversé par le tramway.",
  "rue d'aix": "Prolongement naturel du cours Belsunce, la rue d'Aix fut l'ancienne voie royale menant à la porte nord de Marseille. Bordée d'immeubles du XVIIIᵉ et XIXᵉ siècles, elle débouche sur la Porte d'Aix (Arc de Triomphe) et demeure aujourd'hui un axe commerçant populaire majeur, témoin de l'histoire migratoire et marchande du centre-ville.",
  'avenue camille pelletan': "Ancienne route d'Aix, cette artère du 3ᵉ arrondissement relie la Porte d'Aix à la Villette sur environ 1 km. Nommée en hommage à l'homme politique Camille Pelletan, elle traverse un tissu urbain dense et populaire, marqué par les grands chantiers de rénovation d'Euroméditerranée et une activité commerciale intense liée aux quartiers nord.",
  'place jules guesde': "Aménagée à l’emplacement d’une ancienne porte des remparts, la place Jules-Guesde — dite Porte d’Aix — est dominée par l’arc de triomphe inauguré en 1839, aujourd’hui monument historique. Dégradée après l’arrivée de l’autoroute en 1971, elle fait l’objet de projets de requalification pour retrouver son rôle de place urbaine majeure.",
  'boulevard national': "Traversant le 3ᵉ arrondissement entre Longchamp et Mirabeau, le boulevard National passe sous les voies de Saint-Charles via un tunnel gravement touché par le bombardement du 27 mai 1944. Aujourd’hui axe de transit vers le nord-est de Marseille, il concentre trafic routier, métro, tram et forte densité urbaine.",
  'avenue roger salengro': "Ancienne « avenue d’Arenc », rebaptisée Roger-Salengro en 1938 puis à nouveau en 1945, cette artère relie le centre aux quartiers nord en traversant les 2ᵉ, 3ᵉ et 15ᵉ arrondissements. Bordée par des ensembles anciens et par les opérations d’Euroméditerranée, elle accueille notamment l’hôpital Européen et le siège de La Provence.",
  'rue de lyon': "Longue de près de 5 km, la rue de Lyon — ancienne route de la Cabucelle et segment de la nationale 8 — doit son nom à l’axe reliant autrefois Marseille à Lyon. Traversant Crottes, Saint-Louis et La Cabucelle, elle demeure la colonne vertébrale d’un secteur industriel et populaire du nord de la ville.",
  'boulevard de plombières': "Situé entre les 3ᵉ et 14ᵉ arrondissements, le boulevard de Plombières relie l’avenue Alexander-Fleming au boulevard Ferdinand-de-Lesseps. Axe routier majeur du nord de Marseille, il est surplombé depuis 1970 par une passerelle connectée à l’autoroute A7.",
  'avenue du maréchal foch': "Ouverte à partir de 1927 sur les terrains d’une ancienne ferme, l’avenue du Maréchal-Foch relie les Cinq-Avenues à la gare de la Blancarde sur près d’un kilomètre. Nommée en 1936, elle s’est construite par étapes jusqu’en 1965, avec le comblement du Jarret, et constitue aujourd’hui un axe majeur du quartier.",
  'chemin du littoral': "Ancienne route reliant le centre-ville aux villages de l'Estaque et de Mourepiane, cet axe longe les infrastructures du Grand Port Maritime de Marseille (GPMM). Marqué par l'histoire industrielle et les bassins de radoub, il offre des points de vue singuliers sur les terminaux de croisières et constitue une artère vitale pour la logistique portuaire du nord de la ville.",
  'place du marché des capucins': "Cœur battant du quartier de Noailles, cette place accueille depuis le milieu du XIXᵉ siècle le marché alimentaire le plus célèbre de Marseille. Située à l'emplacement d'un ancien couvent de l'ordre des Capucins, elle est le symbole de la mixité culturelle et de la vitalité populaire de l'hypercentre, caractérisée par ses étals d'épices, de fruits et de légumes.",
  'place sébastopol': "Aménagée au XIXᵉ siècle dans le quartier du Camas, la place Sébastopol est un repère social majeur du 4ᵉ arrondissement. Connue pour son marché quotidien et ses terrasses ombragées par des platanes, elle s'organise autour d'une architecture homogène d'immeubles bourgeois et constitue un lieu de convivialité villageois au cœur de la ville.",
  'boulevard périer': "Tracé en 1849 par Théophile Périer, qui céda le terrain à la ville, le boulevard Périer relie l’avenue du Prado au nord-est du 8ᵉ arrondissement. Bordée d’immeubles haussmanniens et bien desservi, il structure le quartier résidentiel bourgeois qui porte son nom.",
  'boulevard vauban': "Rebaptisé en 1843 après avoir été la rue Montebello, le boulevard Vauban relie Breteuil à Saint-François-d’Assise et sert d’accès pentu vers la colline de la Garde. Desservant le quartier du même nom, il constitue un passage clé vers Notre-Dame-du-Gardes et un axe résidentiel structurant.",
  'rond-point du prado': "Situé à l’intersection du Prado, de Michelet et de Rabatau, le rond-point du Prado constitue la principale porte sud de Marseille. Réaménagé entre 2009 et 2015 avec trottoirs élargis, piste cyclable et plantations renforcées, il s’affirme aujourd’hui comme un carrefour stratégique reliant centre-ville, plages, stade et axes autoroutiers.",
  'place de la préfecture': "Officiellement nommée Place Félix-Baret depuis 1937, cette place est dominée par l’Hôtel de Préfecture des Bouches-du-Rhône, édifice monumental inauguré en 1867 sous le Second Empire. Située à l'extrémité de la rue Saint-Ferréol, elle sert de centre administratif et de jonction entre les secteurs commerçants et résidentiels du 6ᵉ arrondissement.",
  "cours d'estienne d'orves": "Aménagé à l’emplacement d’une ancienne portion du canal de la Douane qui desservait l’arsenal des galères, le Cours Honoré-d’Estienne-d’Orves fut comblé entre 1927 et 1929 avant d’être transformé en vaste esplanade piétonne en 1989. Nommé en hommage au résistant Estienne d’Orves, il constitue aujourd’hui un repère culturel et touristique majeur du Vieux-Port.",
  'place aux huiles': "Située près du Vieux-Port, la place aux Huiles occupe l’ancien canal de la Douane, où l’on débarquait autrefois les barriques d’huile destinées aux savonneries de la rue Sainte. Comblé entre 1927 et 1929 puis transformé en esplanade piétonne en 1989, ce site est devenu un lieu de vie commerçant tout en conservant la mémoire portuaire du quartier.",
  "rue d'endoume": "Ancien « chemin d’Endoume », la rue d’Endoume s’étend sur environ 2,1 km dans le 7ᵉ arrondissement, de Saint-Victor aux pentes d’Endoume. Traversant Saint-Victor, Bompard et Endoume, desservie de longue date par bus et trolley, elle constitue un axe résidentiel important reliant le centre et le littoral.",
  'chemin du roucas blanc': "Axe escarpé et sinueux traversant le quartier résidentiel le plus élevé de Marseille, ce chemin relie la Corniche Kennedy au quartier de Vauban. Bordé de villas luxueuses, de jardins suspendus et d'escaliers pittoresques, il offre des points de vue uniques sur la baie et les îles du Frioul, témoignant du développement balnéaire du XIXᵉ siècle.",
  'rue belle de mai': "Artère principale du quartier ouvrier historique du 3ᵉ arrondissement, elle relie les boulevards urbains au secteur des anciennes manufactures des tabacs, aujourd'hui reconverties en pôle culturel (la Friche). Elle incarne l'histoire industrielle de Marseille et demeure une voie vivante, jalonnée de commerces et de repères populaires.",
  'avenue de saint-antoine': "Ancien segment de la route nationale 8, l'avenue de Saint-Antoine traverse le quartier du même nom dans le 15ᵉ arrondissement, à l'extrême nord de Marseille. Axe de passage historique vers Aix-en-Provence, elle s'est développée autour d'un ancien noyau villageois aujourd'hui marqué par l'activité commerciale et la proximité du centre Grand Littoral.",
  "plage de l'estaque": "Située à l'extrémité nord du littoral marseillais, la plage de l'Estaque est indissociable du village de pêcheurs rendu célèbre par les peintres impressionnistes et Paul Cézanne. Entre ports de plaisance et jetées rocheuses, le secteur offre un accès à la mer authentique, marqué par la dégustation de chichis et panisses et une vue panoramique sur la digue du large.",
  'avenue de la pointe rouge': "Prolongeant le littoral sud au-delà du Prado, cette avenue longe les plages de sable et les ports de plaisance jusqu'au quartier de la Pointe Rouge. Axe balnéaire et touristique très fréquenté, elle dessert de nombreux clubs nautiques et restaurants, constituant la porte d'entrée vers le parc national des Calanques via les Goudes.",
  'boulevard de la blancarde': "Situé dans le 4ᵉ arrondissement, ce boulevard relie les Cinq-Avenues à la gare de la Blancarde, pôle d'échanges multimodal majeur de l'est marseillais. Bordé d'immeubles de type faubourg et desservi par le tramway, il structure un quartier résidentiel et dynamique, autrefois marqué par la présence de propriétés agricoles disparues au XIXᵉ siècle.",
  'avenue des chartreux': "Dans le 4ᵉ arrondissement, l’avenue des Chartreux relie Saint-Just aux boulevards Foch, Libération et Blancarde. Elle doit son nom au monastère des Chartreux fondé en 1633, dont subsiste l’église Sainte-Marie-Madeleine. L’avenue marque la transformation d’un ancien domaine religieux en quartier urbain.",
  'avenue de la rose': "Axe structurant du 13ᵉ arrondissement, l'avenue de la Rose relie le quartier des Chartreux au village de la Rose. Ancienne voie rurale bordée de bastides, elle est devenue au XXᵉ siècle une artère urbaine dense, desservie par le métro aérien, reliant le centre-ville aux grands ensembles et aux technopôles du nord-est.",
  'chemin de morgiou': "Route étroite et sinueuse de près de 4 km, ce chemin part du quartier de Mazargues pour descendre au cœur du Parc National des Calanques jusqu'au petit port de pêche de Morgiou. Ancien sentier muletier, il est aujourd'hui une voie d'accès réglementée offrant un paysage spectaculaire de falaises calcaires et de cabanons typiques.",
  'avenue de mazargues': "L’Avenue de Mazargues — située dans les 8ᵉ et 9ᵉ arrondissements — prolonge l’axe de la rue Paradis depuis l’avenue du Prado jusqu’à la rue Émile-Zola. Ancien chemin rural, elle a été officiellement nommée « avenue de Mazargues » en 1964, et relie centre-ville et quartiers sud en traversant Saint-Giniez, Sainte-Anne et Mazargues, avec un tissu urbain plutôt résidentiel et commercial de proximité.",
  'chemin de la madrague ville': "Historiquement lié à l'activité de pêche à la madrague (thon), ce chemin du 15ᵉ arrondissement traverse les quartiers nord en longeant les zones industrielles et portuaires. Aujourd'hui en pleine mutation avec les projets urbains, il demeure un témoin du passé maritime et industriel de Marseille, reliant le marché aux puces aux bassins d'Arenc.",
  'avenue de la capelette': "Ancienne section de la route de Toulon, l’avenue de la Capelette doit son nom à une petite chapelle (« capeleta ») jadis implantée sur place. Elle structure aujourd’hui un quartier populaire du 10ᵉ arrondissement, mêlant habitat, commerces et projets de renouvellement urbain.",
  'avenue des caillols': "Axe principal du 12ᵉ arrondissement, l'avenue des Caillols relie le quartier de Saint-Barnabé à la vallée de l'Huveaune. Autrefois bordée de domaines agricoles et de carrières, elle s'est urbanisée au XXᵉ siècle pour devenir une artère résidentielle majeure, desservie par le tramway et bordée de commerces et de services publics.",
  'boulevard de saint-loup': "Traversant le quartier éponyme dans le 10ᵉ arrondissement, ce boulevard suit le tracé de l'ancienne route de la vallée de l'Huveaune. Il dessert un tissu urbain mixte, composé de noyaux villageois anciens, d'ensembles résidentiels modernes et de zones d'activités, constituant un axe de liaison essentiel vers le sud-est de Marseille.",
  'boulevard de saint-marcel': "Prolongement de la route de la vallée vers Aubagne, ce boulevard traverse le quartier historique de Saint-Marcel dans le 11ᵉ arrondissement. Marqué par un passé industriel et la présence de la ligne ferroviaire, il conserve des traces de son noyau villageois et structure la circulation le long de l'Huveaune vers l'est de la métropole.",
  'avenue de saint-barnabé': "Axe central du 12ᵉ arrondissement, cette avenue relie les Cinq-Avenues au noyau villageois de Saint-Barnabé. Ancienne allée résidentielle bordée de bastides, elle s'est transformée en une artère commerçante prisée, conservant une atmosphère de village urbain tout en étant connectée au centre-ville par le métro.",
  'rue saint-pierre': "Longue d’environ 3,4 km, la rue Saint-Pierre — plus longue rue de Marseille — suit l’ancien chemin menant au cimetière éponyme. Traversant cinq arrondissements et desservant notamment le cimetière Saint-Pierre et l’hôpital de la Timone, elle forme aujourd’hui un axe urbain essentiel mêlant circulation, services et mémoire.",
  "rue d'aubagne": "Longue d’environ 835 m entre la rue des Récolettes et la place Paul Cézanne, la rue d’Aubagne a été marquée par l’effondrement de deux immeubles en 2018, révélateur de l’habitat insalubre. Depuis, un vaste programme de réhabilitation est engagé, avec acquisitions, démolitions et création d’un lieu de mémoire et de services publics.",
  'rue des catalans': "Située à l'entrée sud du Vieux-Port, cette rue doit son nom à une colonie de pêcheurs espagnols installée dans les vestiges de l'infirmerie du Lazaret au XVIIIᵉ siècle. Elle mène à la plage des Catalans, première plage de la Corniche, et constitue un trait d'union entre le quartier du Pharo et le littoral marseillais.",
  'autoroute est': "Inaugurée dans les années 1950 sous le nom d'A50, l'Autoroute Est relie le tunnel Prado-Carénage à Toulon. Traversant la vallée de l'Huveaune, elle constitue la principale porte d'entrée orientale de la ville, irriguant les quartiers des 10ᵉ et 11ᵉ arrondissements et desservant les zones commerciales majeures de la Valentine.",
  'l2 est': "Partie intégrante de l'autoroute A507 ouverte en 2016, la L2 Est relie l'autoroute A50 à Saint-Jérôme. Ce tronçon de la rocade de contournement, attendu pendant plusieurs décennies, est en grande partie enterré ou encaissé, visant à désengorger les boulevards urbains tout en intégrant des aménagements paysagers en surface.",
  'l2 nord': "Dernier tronçon de la rocade A507 inauguré en 2018, la L2 Nord relie Saint-Jérôme à l'autoroute A7 (Arnavaux). Elle parachève le contournement du centre-ville de Marseille, facilitant les échanges entre le nord et l'est de la ville grâce à un tracé moderne incluant des murs antibruit décorés de street-art et des échangeurs stratégiques.",
  'autoroute du littoral': "Segment de l'autoroute A55, cette voie rapide longe les bassins du Grand Port Maritime de Marseille depuis la Joliette jusqu'à l'Estaque. Offrant des vues spectaculaires sur la mer et les terminaux portuaires, elle constitue l'axe de transit principal pour les voyageurs accédant au port et aux quartiers nord-ouest de la cité.",
  'tunnel du vieux-port': "Inauguré en 1967, ce tunnel sous-marin long de 600 m relie les quais nord et sud du Vieux-Port (quai du Port au quai de Rive-Neuve). Ouvrage technique majeur, il a permis de dévier le trafic de transit des quais historiques, facilitant ainsi la piétonnisation du centre ancien et la fluidité entre la Joliette et le Carénage.",
  'autoroute du soleil': "Appellation historique de l'A7, elle constitue l'entrée nord monumentale de Marseille, débouchant sur la Porte d'Aix. Axe vital reliant la ville à Lyon et Paris, elle traverse les quartiers nord et fait l'objet de projets de requalification urbaine visant à transformer ses derniers hectomètres en boulevard urbain apaisé.",
  'tunnel du prado carénage': "Ouvert en 1993, ce tunnel routier payant de 2,5 km utilise en partie l'ancien tunnel ferroviaire reliant le bassin de Carénage au Prado. Il permet de traverser Marseille d'est en ouest sans passer par le centre-ville, reliant l'autoroute A50 à l'autoroute A55 et au tunnel du Vieux-Port.",
  'tunnel prado-carénage': "Ouvert en 1993, ce tunnel routier payant de 2,5 km utilise en partie l'ancien tunnel ferroviaire reliant le bassin de Carénage au Prado. Il permet de traverser Marseille d'est en ouest sans passer par le centre-ville, reliant l'autoroute A50 à l'autoroute A55 et au tunnel du Vieux-Port."
}

// Infos historiques / descriptives pour les rues principales
const MAIN_STREET_INFOS = {
  'rue de la république': "Ouverte en 1864 sous le nom de « rue Impériale » pour relier le Vieux-Port à la Joliette, elle a supprimé 935 maisons et 61 rues au profit d’un tracé haussmannien. Rebaptisée « rue de la République » après la chute du Second Empire, elle demeure l’un des marqueurs urbains et historiques majeurs de Marseille.",
  'la canebière': "Avenue née entre 1666 et 1672 lors de l’agrandissement de Louis XIV, la Canebière — nommée d’après le chanvre (canebe) — s’étend sur près d’un kilomètre du Vieux-Port aux Réformés, intégrant depuis 1927 Noailles et les allées de Meilhan. Élargie au XIXᵉ siècle et structurée autour d’édifices comme le Palais de la Bourse, elle reste un repère historique et architectural majeur de Marseille.",
  'quai des belges': "Situé sur le front est du Vieux-Port, le Quai des Belges a vu son rôle évoluer après l’ouverture du tunnel du Vieux-Port en 1967. Rebaptisé en 2013 et réaménagé la même année en vaste esplanade piétonne avec l’Ombrière de Norman Foster, il demeure un repère historique central de Marseille.",
  'boulevard des dames': "Boulevard ouvert à partir de 1812 sur l’ancien tracé des remparts nord et prolongé dans les années 1860 vers la Joliette, il porte un nom honorant les femmes ayant défendu Marseille en 1524. Structurant le secteur des Grands-Carmes, il a révélé en 2022 un vestige de rempart du XVIIᵉ siècle.",
  'cours julien': "Aménagé au XIXᵉ siècle sur les anciennes lices de l’enceinte démolie, le Cours Julien devint dès 1860 le centre du commerce de gros marseillais, accueillant le marché central jusqu’en 1972. Ses entrepôts réaffectés ont ensuite façonné un quartier culturel et artistique majeur, aujourd’hui marqué par le street-art, les cafés et les lieux indépendants.",
  'cours lieutaud': "Ouvert en 1864 pour relier le sud de Marseille au boulevard Garibaldi, le Cours Lieutaud adopte un tracé aménagé sous un talus, dominé par le pont de la rue d’Aubagne, et bordé d’immeubles haussmanniens du XIXᵉ siècle. Requalifié entre 2019 et 2021, il a été apaisé par l’élargissement des trottoirs, les pistes cyclables et la réduction de la circulation.",
  'cours d’estienne d’orves': "Aménagé à l’emplacement de l’ancien canal de la Douane qui desservait l’arsenal des galères, le Cours Honoré-d’Estienne-d’Orves fut comblé entre 1927 et 1929 avant d’être transformé en vaste esplanade piétonne en 1989. Nommé en hommage au résistant Estienne d’Orves, il constitue aujourd’hui un repère culturel et touristique majeur du Vieux-Port.",
  'cours jean ballard': "Ouvert sur l’ancien tracé oriental du canal de la Douane comblé dans les années 1920, le Cours Jean-Ballard relie la rue Breteuil au quai de Rive-Neuve. Il porte le nom de Jean Ballard, fondateur des Cahiers du Sud, et demeure un témoin de la transformation du Vieux-Port en tissu urbain moderne.",
  'rue breteuil': "Prolongement du Cours Jean-Ballard, la rue Breteuil suit l’ancien canal de la Douane comblé à la fin des années 1920 et porte le nom de Breteuil, officier de Louis XIV. Elle se distingue notamment par la Grande Synagogue de Marseille (1863-1864), aujourd’hui monument historique.",
  'rue saint-ferréol': "Ouverte en 1693 lors de l’agrandissement de Marseille sous Louis XIV, la rue Saint-Ferréol relie aujourd’hui la place Félix-Baret à la Canebière. Bordée d’immeubles de l’Ancien Régime et du XIXᵉ siècle, elle constitue l’une des principales artères piétonnes et commerçantes historiques de la ville.",
  'rue paradis': "Issue d’un premier tracé ouvert vers 1666 sous Louis XIV puis prolongée jusqu’en 1880, la rue Paradis relie aujourd’hui la place du Général-de-Gaulle à l’avenue du Prado sur près de 2,9 km, faisant d’elle l’une des plus longues voies de Marseille. Son nom vient d’un ancien prieuré médiéval, et elle s’est affirmée comme un axe résidentiel et bourgeois marqué par ses hôtels particuliers, ses façades soignées et l’église Saint-Joseph.",
  'rue de rome': "Ouverte après l’agrandissement de Marseille sous Louis XIV et prolongée en 1774 jusqu’à Castellane, la rue de Rome est devenue l’un des grands axes du centre-ville, long d’environ 1,2 km. Marquée par des immeubles anciens et des repères patrimoniaux comme la maison de Pierre Puget, elle a été requalifiée en 2015 avec l’arrivée du tramway et l’élargissement des trottoirs.",
  'cours pierre puget': "Tracé en 1800 sous le nom de « cours Bonaparte », le cours Pierre-Puget relie la place Estrangin-Pastré à la colline Puget et s’orne d’immeubles haussmanniens ainsi que du palais de justice voisin, implanté à la fin du XIXᵉ siècle. Une statue de Pierre Puget, installée en 1906, renforce son ancrage dans l’histoire artistique et urbaine marseillaise.",
  'place jean jaurès': "Établie sur un ancien plateau médiéval servant de camp, de champ de manœuvres et de lieu de foires, la place Jean-Jaurès — dite « La Plaine » — s’est affirmée dès le XIXᵉ siècle comme grand marché populaire. Rebaptisée en 1919 en hommage à Jean Jaurès, elle demeure un repère historique et social majeur de Marseille.",
  'place castellane': "Créée en 1774, la place Castellane est devenue un carrefour majeur du centre-sud de Marseille, à la jonction de la rue de Rome, du Prado et du boulevard Baille. Au centre se dresse depuis 1913 la Fontaine Cantini, œuvre en marbre de Carrare représentant trois fleuves provençaux, qui a remplacé l’obélisque de 1811 et constitue aujourd’hui l’un de ses marqueurs emblématiques.",
  'avenue du prado': "Aménagée au XIXᵉ siècle pour prolonger l’axe central de la ville jusqu’aux plages, l’avenue du Prado — ancien « boulevard du Sud » — a transformé les terrains marécageux du sud de Marseille en un vaste corridor urbain de 60 m de large, planté d’arbres. Bordée d’immeubles anciens, de commerces et d’équipements majeurs, elle demeure l’un des grands axes structurants de la ville.",
  'rond-point du prado': "Situé à l’intersection du Prado, de Michelet et de Rabatau, le rond-point du Prado constitue la principale porte sud de Marseille. Réaménagé entre 2009 et 2015 avec trottoirs élargis, piste cyclable et plantations renforcées, il s’affirme aujourd’hui comme un carrefour stratégique reliant centre-ville, plages, stade et axes autoroutiers.",
  'boulevard michelet': "S’étendant sur 2,5 km du rond-point du Prado à l’obélisque de Mazargues, le boulevard Michelet constitue l’un des grands axes sud de Marseille. Bordé de repères majeurs — Cité radieuse de Le Corbusier, stade Vélodrome, bastides anciennes — il articule architecture moderne et patrimoine historique dans un même corridor urbain.",
  'boulevard rabatau': "Du rond-point du Prado à la place de Pologne, le boulevard Rabatau structure le sud-est de Marseille, longeant le parc Chanot et l’hôpital Saint-Joseph. Partiellement intégré à la rocade du Jarret, il est en requalification depuis 2022 avec trottoirs élargis, pistes cyclables et végétalisation.",
  'avenue jules cantini': "L’Avenue Jules-Cantini relie la place Castellane au boulevard Rabatau à Marseille, traversant les 6ᵉ, 8ᵉ et 10ᵉ arrondissements. Elle portait originellement le nom de \« boulevard de la Gare du Sud \» et a reçu sa dénomination actuelle en 1920, en hommage à Jules Cantini, mécène marseillais.",
  'boulevard baille': "Ouvert au public entre 1857 et 1861 à partir d’un ancien cul-de-sac privé, le boulevard Baille relie Castellane au boulevard Jean-Moulin sur 1,3 km. Bordé de commerces, d’habitations et d’équipements hospitaliers, il est devenu un axe structurant des 5ᵉ et 6ᵉ arrondissements.",
  'boulevard chave': "Percé dès 1830 et structuré en 1841, le boulevard Chave relie La Plaine à la gare de la Blancarde sur environ 1,5 km, formant l’axe central du Camas. Urbanisé selon le lotissement conçu par les frères André et Nicolas-Henri Chave, avec ses « immeubles trois fenêtres » du XIXᵉ siècle, il est desservi par le tramway depuis 1893 et demeure un repère résidentiel majeur.",
  'allée léon gambetta': "Ouverte au public en 1775 sous le nom de « Cours des Capucines », l’allée Léon-Gambetta relie la place des Capucines au square Stalingrad en plein centre de Marseille. Rebaptisée en 1920 en hommage à Gambetta, elle a accueilli tram puis bus et demeure une traversée urbaine historique du 1ᵉʳ arrondissement.",
  'boulevard de la libération': "Prolongement de la Canebière jusqu’aux Cinq-Avenues, le boulevard de la Libération — ancien boulevard de la Madeleine — traverse les 1ᵉʳ, 4ᵉ et 5ᵉ arrondissements. Rebaptisé après 1944 en hommage à la libération de Marseille, il demeure une artère commerçante et mémorielle structurante du centre-est de la ville.",
  'boulevard françoise duparc': "Ancien « boulevard du Jarret », le boulevard Françoise-Duparc correspond à la portion du Jarret recouvert entre 1954 et 1968, transformant l’ancienne rivière en axe urbain majeur du 4ᵉ arrondissement. Renommé en 1938 en hommage à l’artiste Françoise Duparc, il structure aujourd’hui la rocade et accueille notamment le complexe sportif Vallier.",
  'boulevard national': "Traversant le 3ᵉ arrondissement entre Longchamp et Mirabeau, le boulevard National passe sous les voies de Saint-Charles via un tunnel gravement touché par le bombardement du 27 mai 1944. Aujourd’hui axe de transit vers le nord-est de Marseille, il concentre trafic routier, métro, tram et forte densité urbaine.",
  'boulevard de plombières': "Situé entre les 3ᵉ et 14ᵉ arrondissements, le boulevard de Plombières relie l’avenue Alexander-Fleming au boulevard Ferdinand-de-Lesseps. Axe routier majeur du nord de Marseille, il est surplombé depuis 1970 par une passerelle connectée à l’autoroute A7.",
  'corniche du président john fitzgerald kennedy': "Aménagée comme chemin côtier entre 1848 et 1863 puis élargie en boulevard panoramique entre 1954 et 1968, la corniche du Président-John-Fitzgerald-Kennedy longe la Méditerranée sur 3,7 km, des Catalans aux plages du Prado. Rebaptisée en 1963, elle est bordée de villas du XIXᵉ siècle, de plages et de restaurants, et offre l’un des panoramas maritimes emblématiques de Marseille.",
  'boulevard de la corderie': "Ouvert en 1860, le boulevard de la Corderie — long de 467 m et nommé d’après les anciennes corderies du quartier Saint-Victor — relie la place éponyme à la rue d’Endoume. Il abrite la carrière antique de la Corderie, site d’extraction grec puis romain aujourd’hui classé, qui en fait un lieu marqué par l’histoire industrielle et urbaine de Marseille.",
  'place aux huiles': "Située près du Vieux-Port, la place aux Huiles occupe l’ancien canal de la Douane, où l’on débarquait autrefois les barriques d’huile destinées aux savonneries de la rue Sainte. Comblé entre 1927 et 1929 puis transformé en esplanade piétonne en 1989, ce site est devenu un lieu de vie commerçant tout en conservant la mémoire portuaire du quartier.",
  'rue saint-pierre': "Longue d’environ 3,4 km, la rue Saint-Pierre — plus longue rue de Marseille — suit l’ancien chemin menant au cimetière éponyme. Traversant cinq arrondissements et desservant notamment le cimetière Saint-Pierre et l’hôpital de la Timone, elle forme aujourd’hui un axe urbain essentiel mêlant circulation, services et mémoire.",
  'boulevard romain rolland': "Long d’environ 2,4 km, le boulevard Romain-Rolland prolonge l’ancien chemin vicinal reliant Saint-Loup à Sainte-Marguerite. Rebaptisé en hommage à l’écrivain, il traverse les 9ᵉ et 10ᵉ arrondissements et dessert un ensemble d’équipements résidentiels et publics, formant un axe utilitaire du sud-est marseillais.",
  'boulevard de sainte-marguerite': "Le boulevard de Sainte-Marguerite, anciennement « chemin de Cassis », traverse le 9ᵉ arrondissement de Marseille du nord au sud, entre la rue Raymond-Teisseire et le boulevard du Cabot. Desservi par métro et tram, il relie des lieux importants — le palais des sports, l’hôpital Sainte-Marguerite, l’Institut Paoli-Calmettes — et structure le quartier Sainte-Marguerite.  ",
  'avenue de mazargues': "L’Avenue de Mazargues — située dans les 8ᵉ et 9ᵉ arrondissements — prolonge l’axe de la rue Paradis depuis l’avenue du Prado jusqu’à la rue Émile-Zola. Ancien chemin rural, elle a été officiellement nommée « avenue de Mazargues » en 1964, et relie centre-ville et quartiers sud en traversant Saint-Giniez, Sainte-Anne et Mazargues, avec un tissu urbain plutôt résidentiel et commercial de proximité.  ",
  'place général de gaulle': "Aménagée vers 1778 après la démolition de l’arsenal des galères, la place du Général-de-Gaulle — longtemps connue sous divers noms — occupe un carrefour central entre la Canebière, la rue Paradis et le palais de la Bourse. Des vestiges antiques de salines et de quais y témoignent d’une activité portuaire très ancienne, renforçant son rôle de repère historique et urbain majeur.",
  'cours belsunce': "Ouvert en 1670 sur les anciennes lices de la ville, le cours Belsunce — nommé en hommage à l’évêque Belsunce, figure de la peste de 1720 — fut l’une des grandes places baroques de Marseille avant de perdre son unité architecturale avec les percements de la fin du XIXᵉ siècle. Remplacé en partie par les tours Labourdette et des constructions modernes, il accueille le théâtre de l’Alcazar reconverti aujourd’hui en bibliothèque et incarne le basculement d’un ancien espace aristocratique vers un quartier populaire dense et traversé par le tramway.",
  'cours saint-louis': "Ouvert en 1670 dans le cadre de l’agrandissement de Louis XIV, le cours Saint-Louis relie la Canebière à la rue de Rome et porte le nom de Louis d’Anjou. Au XIXᵉ siècle, Pascal Coste y installe dix-huit pavillons en fonte pour les bouquetières. Traversé aujourd’hui par le tramway, il demeure un point nodal du centre-ville mêlant mémoire et commerce.",
  'place jules guesde': "Aménagée à l’emplacement d’une ancienne porte des remparts, la place Jules-Guesde — dite Porte d’Aix — est dominée par l’arc de triomphe inauguré en 1839, aujourd’hui monument historique. Dégradée après l’arrivée de l’autoroute en 1971, elle fait l’objet de projets de requalification pour retrouver son rôle de place urbaine majeure.",
  'boulevard camille flammarion': "Classé en 1858 puis rebaptisé en 1926, le boulevard Camille-Flammarion — ancien chemin de Gabiers puis boulevard Saint-Charles — relie le boulevard National à Isidore-Dagnan, en bordure de la gare Saint-Charles. Il forme aujourd’hui un axe résidentiel dense mêlant commerces, logements et équipements publics.",
  'avenue des chutes lavie': "Longue d’environ 1,4 km, l’avenue des Chutes-Lavie traverse les 4ᵉ et 13ᵉ arrondissements et forme l’axe principal du quartier. Elle est marquée par le pavillon de partage des eaux (1899-1906), témoin de l’adduction d’eau vers les quartiers nord.",
  'boulevard périer': "Tracé en 1849 par Théophile Périer, qui céda le terrain à la ville, le boulevard Périer relie l’avenue du Prado au nord-est du 8ᵉ arrondissement. Bordé d’immeubles haussmanniens et bien desservi, il structure le quartier résidentiel bourgeois qui porte son nom.",
  'rue d’endoume': "Ancien « chemin d’Endoume », la rue d’Endoume s’étend sur environ 2,1 km dans le 7ᵉ arrondissement, de Saint-Victor aux pentes d’Endoume. Traversant Saint-Victor, Bompard et Endoume, desservie de longue date par bus et trolley, elle constitue un axe résidentiel important reliant le centre et le littoral.",
  'boulevard notre-dame': "Ouvert dans les années 1860 et classé en 1865, le boulevard Notre-Dame relie la Corderie à Vauban en descendant la colline de la Garde. Un temps nommé « boulevard Notre-Dame-de-la-Garde », il forme aujourd’hui un axe pentu essentiel entre centre-ville et basilique.",
  'boulevard vauban': "Rebaptisé en 1843 après avoir été la rue Montebello, le boulevard Vauban relie Breteuil à Saint-François-d’Assise et sert d’accès pentu vers la colline de la Garde. Desservant le quartier du même nom, il constitue un passage clé vers Notre-Dame-de-la-Garde et un axe résidentiel structurant.",
  'boulevard de paris': "Ancien « chemin du Lazaret » classé en 1859, le boulevard de Paris traverse en ligne droite La Joliette, Arenc et La Villette dans les 2ᵉ et 3ᵉ arrondissements. Desservi par métro, tram et TER, il longe hôpital, docks et zones portuaires, formant un axe de liaison entre ville et port.",
  'boulevard de strasbourg': "Long de 550 m et classé en 1867, le boulevard de Strasbourg — ancien boulevard du Maupas puis du Marché de Saint-Lazare, rebaptisé en 1871 — relie la place de Strasbourg au boulevard National dans le 3ᵉ arrondissement. Il accueille la caserne des Douanes et le centre des marins-pompiers, constituant un axe structurant vers le nord-est.",
  'rue caisserie': "Longue d’environ 835 m, la rue Caisserie relie le quai du Port à la place de Lenche dans le 2ᵉ arrondissement et doit son nom aux anciennes « caisseries » médiévales. Bordant la zone détruite du Vieux-Port en 1943, elle a été en partie reconstruite avec, notamment, les tours en U de Gaston Castel et plusieurs édifices historiques.",
  'place de lenche': "Considérée comme la plus ancienne place de Marseille, la place de Lenche occupe probablement l’emplacement de l’agora de Massalia. Elle doit son nom à la famille corse Lenche, qui y possédait au XVIᵉ siècle un hôtel particulier abritant aujourd’hui le théâtre du même nom. Ancien site de couvent puis de fonderie royale, elle forme aujourd’hui un carrefour vivant du Panier avec vue sur la mer.",
  'rue colbert': "Percée haussmannienne ouverte entre 1882 et 1889, la rue Colbert relie la Joliette au centre ancien en remplacement d’anciens îlots, dont l’église Saint-Martin. D’abord nommée rue de l’Impératrice puis rue du Peuple, elle reçoit son nom en 1875. Son principal marqueur est l’Hôtel des Postes (1889-1891), monument post-haussmannien emblématique.",
  'rue grignan': "Lotie en 1820 sur l’ancien domaine du comte de Grignan, la rue Grignan relie la rue de Rome à la Corderie et s’est bordée au XIXᵉ siècle d’hôtels particuliers et d’un temple protestant. Aujourd’hui marquée par une architecture bourgeoise et des commerces de luxe, elle s’insère dans un secteur culturel structuré autour du musée Cantini.",
  'rue d’aubagne': "Longue d’environ 835 m entre la rue des Récolettes et la place Paul Cézanne, la rue d’Aubagne a été marquée par l’effondrement de deux immeubles en 2018, révélateur de l’habitat insalubre. Depuis, un vaste programme de réhabilitation est engagé, avec acquisitions, démolitions et création d’un lieu de mémoire et de services publics.",
  'boulevard d’athènes': "Long de 227 m entre la place des Capucines et la place des Marseillaises, le boulevard d’Athènes prolonge Dugommier et débouche sur l’escalier monumental de la gare Saint-Charles. Ouvert sous Delacroix et achevé sous Thibaudeau, il concentre quelques bâtiments marquants et sert de liaison centrale entre gare, centre-ville et quartiers nord-est.",
  'boulevard dugommier': "Créé en 1792 sur l’emplacement des anciens remparts, le boulevard Dugommier prolonge le boulevard d’Athènes jusqu’à la Canebière. Nommé en hommage au général Dugommier et lié à des figures comme Louise Michel, il demeure un axe central desservi par métro et tram, marqué par une forte densité urbaine et une mémoire politique.",
  'boulevard garibaldi': "Ancien « boulevard du Musée », le boulevard Garibaldi relie le cours Lieutaud à la Canebière et fut rebaptisé en hommage à Giuseppe Garibaldi après 1870. Il conserve des marqueurs historiques comme la chapelle des Bernardines, ancien couvent devenu théâtre, et des traces d’épisodes marquants de la Seconde Guerre mondiale.",
  'rue de lodi': "Longue d’environ 640 m dans le 6ᵉ arrondissement, la rue de Lodi — ancien « chemin de Briquet » rebaptisé en 1796 — relie Notre-Dame-du-Mont à la rue Sainte-Cécile. Elle a accueilli l’hôpital militaire Michel-Lévy jusqu’en 1988 et conserve des repères comme l’église Notre-Dame-du-Mont.",
  'rue du rouet': "Ancien « chemin du Rouet », la rue du Rouet traverse les 6ᵉ et 8ᵉ arrondissements et forme l’axe central d’un quartier autrefois industriel — savonneries, huileries, habitat ouvrier. Devenu résidentiel et dense, le secteur mêle aujourd’hui immeubles anciens, constructions récentes et commerces de proximité.",
  'avenue du maréchal foch': "Ouverte à partir de 1927 sur les terrains d’une ancienne ferme, l’avenue du Maréchal-Foch relie les Cinq-Avenues à la gare de la Blancarde sur près d’un kilomètre. Nommée en 1936, elle s’est construite par étapes jusqu’en 1965, avec le comblement du Jarret, et constitue aujourd’hui un axe majeur du quartier.",
  'avenue des chartreux': "Dans le 4ᵉ arrondissement, l’avenue des Chartreux relie Saint-Just aux boulevards Foch, Libération et Blancarde. Elle doit son nom au monastère des Chartreux fondé en 1633, dont subsiste l’église Sainte-Marie-Madeleine. L’avenue marque la transformation d’un ancien domaine religieux en quartier urbain.",
  'cours joseph thierry': "Long de 147 m et large de 47 m, le cours Joseph-Thierry — ancien cours du Chapitre — relie le boulevard Longchamp au square Stalingrad. Nommé en hommage au ministre Joseph Thierry, il marque l’entrée du quartier Le Chapitre et accueille marché, métro et tramway.",
  'place félix baret': "Ancienne place Saint-Ferréol jusqu’en 1937, la place Félix-Baret porte le nom d’un maire de la fin du XIXᵉ siècle. Elle est dominée par l’Hôtel de Préfecture des Bouches-du-Rhône, grand édifice du Second Empire inauguré en 1867 et repère administratif majeur du 6ᵉ arrondissement.",
  'avenue roger salengro': "Ancienne « avenue d’Arenc », rebaptisée Roger-Salengro en 1938 puis à nouveau en 1945, cette artère relie le centre aux quartiers nord en traversant les 2ᵉ, 3ᵉ et 15ᵉ arrondissements. Bordée par des ensembles anciens et par les opérations d’Euroméditerranée, elle accueille notamment l’hôpital Européen et le siège de La Provence.",
  'boulevard du capitaine gèze': "Long d’environ 965 m dans les 14ᵉ-15ᵉ arrondissements, le boulevard du Capitaine-Gèze — ancien prolongement du boulevard Oddo — a été renommé en hommage à un officier tué lors de la Libération de 1944. Axe stratégique entre A7, port et quartiers nord, il est aujourd’hui desservi par le terminus de métro Gèze.",
  'avenue viton': "Longue d’environ 413 m dans le 9ᵉ arrondissement, l’avenue Viton doit son nom à l’armateur Pierre-Jean-Baptiste Viton, bienfaiteur de l’hospice de Sainte-Marguerite. Elle longe l’hôpital du même nom, dont elle constitue l’un des accès principaux.",
  'rue de lyon': "Longue de près de 5 km, la rue de Lyon — ancienne route de la Cabucelle et segment de la nationale 8 — doit son nom à l’axe reliant autrefois Marseille à Lyon. Traversant Crottes, Saint-Louis et La Cabucelle, elle demeure la colonne vertébrale d’un secteur industriel et populaire du nord de la ville.",
  'boulevard jeanne d’arc': "Long de 812 m dans le 5ᵉ arrondissement, le boulevard Jeanne-d’Arc relie les places Léon-Imbert et Pol-Lapeyre. Hommage à Jeanne d’Arc, il est marqué par des repères comme le lycée Marie-Curie et l’église Saint-Pierre.",
  'avenue de la capelette': "Ancienne section de la route de Toulon, l’avenue de la Capelette doit son nom à une petite chapelle (« capeleta ») jadis implantée sur place. Elle structure aujourd’hui un quartier populaire du 10ᵉ arrondissement, mêlant habitat, commerces et projets de renouvellement urbain.",
  'avenue de montolivet': "Longue de 2,29 km entre Duparc et le chemin de l’Oule, l’avenue de Montolivet — ancien chemin vicinal n° 25 — grimpe la colline du quartier, reliant ce secteur résidentiel au centre. Elle traverse un ancien village agricole urbanisé, marqué par l’église Saint-Fortuné et le parc de la Moline.",
  'avenue de saint-just': "Longue de 710 m dans les 4ᵉ et 13ᵉ arrondissements, l’avenue de Saint-Just prolonge l’avenue des Chartreux vers le nord. Elle traverse l’ancien village de Saint-Just, aujourd’hui intégré à la ville, et relie ce secteur résidentiel en mutation à la périphérie marseillaise.",
  'cours gouffé': "Long de 524 m entre Baille et la place Gouffé, le cours Gouffé est ouvert à la fin du XVIIIᵉ siècle sur des terrains de la famille du même nom, liée au jardin botanique. Il a accueilli au XIXᵉ siècle une communauté de Mamelouks réfugiés, dont plusieurs furent victimes du massacre de 1815.",
};


// Liste indicative de noms de monuments normalisés (pas utilisée directement pour le jeu)


function normalizeName(name) {
  return (name || '').trim().toLowerCase();
  // Safe comment to force git update
}

// ------------------------
// Variables globales
// ------------------------

let map = null;

// Zones
let currentZoneMode = 'ville';      // 'ville' | 'quartier' | 'rues-principales' | 'monuments'

// Données et couches rues
let streetsLayer = null;
let allStreetFeatures = [];
let streetLayersById = new Map();
let streetLayersByName = new Map();  // index par nom normalisé → Layer[]

// Données et couches monuments
let monumentsLayer = null;
let allMonuments = [];
let sessionMonuments = [];
let currentMonumentIndex = 0;
let currentMonumentTarget = null;
let isMonumentsMode = false;

// Quartiers
let quartierPolygonsByName = new Map();
let quartierOverlay = null;

// Normalisation des clés de quartier (pour matcher GeoJSON / table)
function normalizeQuartierKey(raw) {
  if (!raw) return '';

  let s = raw.trim();

  // Cas "Chapitre (Le)" → "Le Chapitre"
  const match = s.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
  if (match) {
    let base = match[1].trim();
    let art = match[2].trim();

    // Unifier L' / L’
    if (/^l[’']/i.test(art)) {
      art = "L'";
    } else {
      // Mettre la majuscule standard : La/Le/Les
      art = art.charAt(0).toUpperCase() + art.slice(1).toLowerCase();
    }

    s = `${art} ${base}`;
  }

  // Supprimer les accents, normaliser espaces, mettre en minuscule
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\s+/g, ' ').toLowerCase();

  return s;
}

// Map normalisée quartier → arrondissement (1er, 2e, etc.)
let arrondissementByQuartier = new Map();
Object.entries(ARRONDISSEMENT_PAR_QUARTIER).forEach(([label, arr]) => {
  arrondissementByQuartier.set(normalizeQuartierKey(label), arr);
});


// Session en cours (rues)
let sessionStreets = [];
let currentIndex = 0;
let currentTarget = null;
let isSessionRunning = false;

// Timers + Pause + Chrono
let sessionStartTime = null;
let streetStartTime = null;

let isPaused = false;
let pauseStartTime = null;
let remainingChronoMs = null;

let isChronoMode = false;
let chronoEndTime = null;

// Scores
let correctCount = 0;
let totalAnswered = 0;
let summaryData = [];
let weightedScore = 0;
let errorsCount = 0;

// Surbrillance rues
let highlightTimeoutId = null;
let highlightedLayers = [];

// Messages
let messageTimeoutId = null;

// Utilisateur courant (auth)
let currentUser = null;

let isLectureMode = false;

let hasAnsweredCurrentItem = false;


function setMapStatus(label, state) {
  const el = document.getElementById('map-status');
  if (!el) return;

  el.textContent = label;

  // reset classes
  el.className = 'map-status-pill';

  if (state === 'loading') {
    el.classList.add('map-status--loading');
  } else if (state === 'ready') {
    el.classList.add('map-status--ready');
  } else if (state === 'error') {
    el.classList.add('map-status--error');
  }
}

// ------------------------
// Détection appareil tactile / mobile
// ------------------------
const IS_TOUCH_DEVICE =
  ('ontouchstart' in window) ||
  navigator.maxTouchPoints > 0;

// ------------------------
// Helpers zone / mode
// ------------------------

function getSelectedQuartier() {
  const sel = document.getElementById('quartier-select');
  if (!sel) return null;
  const value = sel.value;
  return value && value.trim() !== '' ? value.trim() : null;
}

function getZoneMode() {
  return currentZoneMode;
}

function updateModeDifficultyPill() {
  const modeSelect = document.getElementById('mode-select');
  const pill = document.getElementById('mode-difficulty-pill');
  if (!modeSelect || !pill) return;

  const value = modeSelect.value;

  pill.classList.remove(
    'difficulty-pill--easy',
    'difficulty-pill--medium',
    'difficulty-pill--hard'
  );

  if (value === 'rues-principales') {
    pill.textContent = 'Facile';
    pill.classList.add('difficulty-pill--easy');
  } else if (value === 'quartier' || value === 'monuments') {
    pill.textContent = 'Faisable';
    pill.classList.add('difficulty-pill--medium');
  } else if (value === 'rues-celebres') {
    pill.textContent = 'Très Facile';
    pill.classList.add('difficulty-pill--easy');
  } else if (value === 'ville') {
    pill.textContent = 'Difficile';
    pill.classList.add('difficulty-pill--hard');
  } else {
    // Valeur inattendue : neutralisation
    pill.textContent = '';
  }
}

function updateTargetPanelTitle() {
  const titleEl = document.getElementById('target-panel-title')
    || document.querySelector('.target-panel .panel-title');
  if (!titleEl) return;

  const zoneMode = getZoneMode();

  if (zoneMode === 'monuments') {
    titleEl.textContent = 'Monument à trouver';
  } else {
    // ville entière, par quartier, rues principales (et tout mode non-monuments)
    titleEl.textContent = 'Rue à trouver';
  }
}

function getGameMode() {
  const select = document.getElementById('game-mode-select');
  return select ? select.value : 'classique';
}

function updateGameModeControls() {
  const gameModeSelect = document.getElementById('game-mode-select');
  const restartBtn = document.getElementById('restart-btn');
  const pauseBtn = document.getElementById('pause-btn');

  if (!gameModeSelect || !restartBtn || !pauseBtn) return;

  if (gameModeSelect.value === 'lecture') {
    // Mode lecture : pas de contrôle de session
    restartBtn.style.display = 'none';
    pauseBtn.style.display = 'none';
  } else {
    // Autres modes : on délègue la visibilité à updateStartStopButton / updatePauseButton
    restartBtn.style.display = '';
  }
}

function updateStreetInfoPanelVisibility() {
  const panel = document.getElementById('street-info-panel');
  const infoEl = document.getElementById('street-info');
  if (!panel || !infoEl) return;

  const zoneMode = getZoneMode();
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    panel.style.display = 'block';
    // on ne met pas is-visible ici : ce sera géré par showStreetInfo
  } else {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
  }
}

// ------------------------
// Initialisation
// ------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Sur mobile : petit statut "Chargement" dans le header
  setMapStatus('Chargement', 'loading');

  initMap();
  initUI();
  startTimersLoop();
  loadStreets();
  loadQuartierPolygons();
  loadMonuments();
  loadAllLeaderboards();
  document.body.classList.add('app-ready');
});

// ------------------------
// Carte
// ------------------------

function initMap() {
  map = L.map('map', {
    tap: true,              // ← nécessaire pour activer les interactions tactiles
    tapTolerance: IS_TOUCH_DEVICE ? 25 : 15,       // ← meilleure sensibilité mobile
    doubleTapZoom: true,    // ← zoomer au double-tap
    renderer: L.canvas({ padding: 0.5 })  // ← Canvas renderer : bien plus performant avec 15K+ polylines
  }).setView([43.2965, 5.37], 13);

  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles © Esri'
    }
  ).addTo(map);

  // Mini-map de situation (coin bas-droit)
  if (typeof L.Control.MiniMap !== 'undefined') {
    const miniMapTiles = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 19, attribution: '© CartoDB' }
    );
    const miniMap = new L.Control.MiniMap(miniMapTiles, {
      position: 'bottomright',
      toggleDisplay: true,
      minimized: IS_TOUCH_DEVICE,
      width: 150,
      height: 150,
      zoomLevelOffset: -5,
      zoomLevelFixed: false,
      collapsedWidth: 24,
      collapsedHeight: 24
    }).addTo(map);
  }
}

// ------------------------
// Interface
// ------------------------

function initUI() {
  // Mode "doigt" pour mobile / tactile
  if (IS_TOUCH_DEVICE) {
    document.body.classList.add('touch-mode');
  }
  const restartBtn = document.getElementById('restart-btn');
  const modeSelect = document.getElementById('mode-select');
  const quartierBlock = document.getElementById('quartier-block');
  const quartierSelect = document.getElementById('quartier-select');
  const skipBtn = document.getElementById('skip-btn');
  const pauseBtn = document.getElementById('pause-btn');
  // Faux select "quartier"
  const quartierBtn = document.getElementById('quartier-select-button');
  const quartierList = document.getElementById('quartier-select-list');
  const quartierLabel = quartierBtn
    ? quartierBtn.querySelector('.custom-select-label')
    : null;

  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');

  if (modeSelect) {
    currentZoneMode = modeSelect.value;
  }
  updateModeDifficultyPill();

  // ----- Nouveau select personnalisé "zone de jeu" -----
  const modeBtn = document.getElementById("mode-select-button");
  const modeList = document.getElementById("mode-select-list");
  const modeLabel = modeBtn ? modeBtn.querySelector(".custom-select-label") : null;

  if (modeBtn && modeList) {
    modeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      modeList.classList.toggle("visible");
    });

    modeList.querySelectorAll("li").forEach(item => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;
        if (modeLabel) modeLabel.textContent = item.childNodes[0].textContent.trim();

        // Mise à jour pastille
        const pillInList = item.querySelector(".difficulty-pill");
        const btnPill = modeBtn.querySelector(".difficulty-pill");
        if (pillInList) {
          const newPill = pillInList.cloneNode(true);
          if (btnPill) btnPill.replaceWith(newPill);
          else modeBtn.appendChild(newPill);
        }

        if (modeSelect) {
          modeSelect.value = value;
          modeSelect.dispatchEvent(new Event("change"));
        }
        modeList.classList.remove("visible");
      });
    });
  }

  // ----- Select personnalisé "type de partie" -----
  const gameModeBtn = document.getElementById("game-mode-select-button");
  const gameModeList = document.getElementById("game-mode-select-list");
  const gameModeLabel = gameModeBtn ? gameModeBtn.querySelector(".custom-select-label") : null;
  const gameModeSelect = document.getElementById("game-mode-select");

  if (gameModeBtn && gameModeList && gameModeSelect) {
    gameModeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      gameModeList.classList.toggle("visible");
    });

    gameModeList.querySelectorAll("li").forEach(item => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;
        if (gameModeLabel) gameModeLabel.textContent = item.childNodes[0].textContent.trim();

        const pillInList = item.querySelector(".difficulty-pill");
        if (pillInList) {
          const newPill = pillInList.cloneNode(true);
          const btnPill = gameModeBtn.querySelector(".difficulty-pill");
          if (btnPill) btnPill.replaceWith(newPill);
          else gameModeBtn.appendChild(newPill);
        }

        gameModeSelect.value = value;
        if (isSessionRunning) endSession();
        updateGameModeControls();
        gameModeList.scrollTop = 0;
        gameModeList.classList.remove("visible");

        if (value === 'lecture') {
          requestAnimationFrame(() => startNewSession());
        }
      });
    });
  }

  // ----- Select personnalisé "quartier" -----
  if (quartierBtn && quartierList) {
    quartierBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Avoid immediate closure
      quartierList.classList.toggle('visible');
    });
  }

  // Ferme les listes si clic ailleurs
  document.addEventListener("click", (e) => {
    if (modeBtn && modeList && !modeBtn.contains(e.target) && !modeList.contains(e.target)) {
      modeList.classList.remove("visible");
    }
    if (gameModeBtn && gameModeList && !gameModeBtn.contains(e.target) && !gameModeList.contains(e.target)) {
      gameModeList.classList.remove("visible");
    }
    if (quartierBtn && quartierList && !quartierBtn.contains(e.target) && !quartierList.contains(e.target)) {
      quartierList.classList.remove("visible");
    }
  });

  // Recharger l'utilisateur courant depuis le stockage local
  currentUser = loadCurrentUserFromStorage();
  updateUserUI();

  // Init sound toggle icon
  const soundBtn = document.getElementById('sound-toggle');
  if (soundBtn) soundBtn.textContent = soundEnabled ? '🔊' : '🔇';

  // Onboarding banner (first visit only)
  if (!localStorage.getItem('camino-onboarded')) {
    const banner = document.getElementById('onboarding-banner');
    if (banner) {
      banner.style.display = 'flex';
      const closeBtn = document.getElementById('onboarding-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          banner.style.display = 'none';
          localStorage.setItem('camino-onboarded', '1');
        });
      }
    }
  }

  // ── Offline / network error detection ──
  function updateOfflineBanner(offline) {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = offline ? 'block' : 'none';
  }

  window.addEventListener('offline', () => updateOfflineBanner(true));
  window.addEventListener('online', () => {
    // Re-check API before hiding banner
    fetch(API_URL + '/api/leaderboards', { method: 'HEAD' })
      .then(() => updateOfflineBanner(false))
      .catch(() => updateOfflineBanner(true));
  });

  // Initial check: ping API
  if (!navigator.onLine) {
    updateOfflineBanner(true);
  } else {
    fetch(API_URL + '/api/leaderboards', { method: 'HEAD' })
      .catch(() => updateOfflineBanner(true));
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      if (!isSessionRunning) {
        startNewSession();
      } else {
        stopSessionManually();
      }
    });
  }

  updateTargetPanelTitle();

  // Bouton Pause
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (!isSessionRunning) return;
      togglePause();
    });
  }

  // Bouton Défi Quotidien
  const dailyBtn = document.getElementById('daily-mode-btn');
  if (dailyBtn) {
    dailyBtn.addEventListener('click', handleDailyModeClick);
  }

  // Bouton "Passer" (tous les modes)
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      if (!isSessionRunning || isPaused) return;

      const zoneMode = getZoneMode();

      if (zoneMode === 'monuments') {
        if (!currentMonumentTarget) return;
        summaryData.push({
          name: currentMonumentTarget.properties.name,
          correct: false,
          time: 0
        });
        totalAnswered += 1;
        updateScoreUI();
        currentMonumentIndex += 1;
        setNewTarget();
        return;
      }

      if (!currentTarget) return;
      summaryData.push({
        name: currentTarget.properties.name,
        correct: false,
        time: 0
      });
      totalAnswered += 1;
      updateScoreUI();
      currentIndex += 1;
      setNewTarget();
    });
  }

  // Changement de zone
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      currentZoneMode = modeSelect.value;
      const zoneMode = currentZoneMode;
      updateTargetPanelTitle();
      updateModeDifficultyPill();

      // Restyle toutes les rues en fonction du nouveau mode
      if (streetsLayer && streetLayersById.size) {
        streetLayersById.forEach(layer => {
          const base = getBaseStreetStyle(layer);
          const isVisible = base.weight > 0;
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });

          // Disable interactivity for hidden streets
          layer.options.interactive = isVisible;
          if (layer.touchBuffer) {
            layer.touchBuffer.options.interactive = isVisible;
          }
        });
      }

      // Quartier UI
      if (zoneMode === 'quartier') {
        quartierBlock.style.display = 'block';
        if (quartierSelect && quartierSelect.value) {
          highlightQuartier(quartierSelect.value);
        }
      } else {
        quartierBlock.style.display = 'none';
        clearQuartierOverlay();
      }

      // Couches
      if (zoneMode === 'monuments') {
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
        if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
          monumentsLayer.addTo(map);
        }
      } else {
        if (monumentsLayer && map.hasLayer(monumentsLayer)) {
          map.removeLayer(monumentsLayer);
        }
        if (streetsLayer && !map.hasLayer(streetsLayer)) {
          streetsLayer.addTo(map);
        }
      }
      updateStreetInfoPanelVisibility();
      refreshLectureTooltipsIfNeeded();

      // >>> ICI : gestion de la boîte "infos rues principales"
      const infoEl = document.getElementById('street-info');
      if (infoEl) {
        if (zoneMode === 'rues-principales' || zoneMode === 'main') {
          // On peut garder le contenu, ou le vider pour repartir propre :
          // infoEl.textContent = '';
          // infoEl.style.display = 'none'; // elle ne se ré-affichera que sur clic via showStreetInfo
        } else {
          infoEl.textContent = '';
          infoEl.style.display = 'none';
        }
      }
    });
  }
  if (quartierSelect) {
    quartierSelect.addEventListener('change', () => {
      const zoneMode = getZoneMode();
      if (zoneMode === 'quartier' && quartierSelect.value) {
        highlightQuartier(quartierSelect.value);
      } else {
        clearQuartierOverlay();
      }

      // IMPORTANT : on applique le nouveau filtre de style à toutes les rues
      if (streetsLayer && streetLayersById.size) {
        streetLayersById.forEach(layer => {
          const base = getBaseStreetStyle(layer);
          const isVisible = base.weight > 0;
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });
          // Mettre à jour l'interactivité (fix: rues hors quartier cliquables)
          layer.options.interactive = isVisible;
          if (layer.touchBuffer) {
            layer.touchBuffer.options.interactive = isVisible;
          }
        });
      }
    });
  }

  // Auth feedback helper
  const authFeedback = document.getElementById('auth-feedback');
  function showAuthFeedback(msg, type) {
    if (!authFeedback) return;
    authFeedback.textContent = msg;
    authFeedback.className = 'auth-feedback ' + (type || '');
  }

  // Password toggle
  const togglePwdBtn = document.getElementById('toggle-password');
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
      const show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      togglePwdBtn.textContent = show ? '🙈' : '👁';
    });
  }

  // Auth events
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      showAuthFeedback('', '');
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!username || !password) {
        showAuthFeedback('Pseudo et mot de passe requis.', 'error');
        return;
      }
      try {
        const res = await fetch(API_URL + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            showAuthFeedback('Identifiants incorrects.', 'error');
          } else {
            showAuthFeedback(data.error || 'Erreur de connexion.', 'error');
          }
          return;
        }
        currentUser = {
          id: data.id,
          username: data.username,
          token: data.token
        };
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showAuthFeedback('Connexion réussie !', 'success');
      } catch (err) {
        console.error('Erreur login :', err);
        showAuthFeedback('Serveur injoignable.', 'error');
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      showAuthFeedback('', '');
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!username || !password) {
        showAuthFeedback('Pseudo et mot de passe requis.', 'error');
        return;
      }
      if (password.length < 4) {
        showAuthFeedback('Mot de passe trop court (min. 4 caractères).', 'error');
        return;
      }
      try {
        const res = await fetch(API_URL + '/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
          if (data.error && data.error.includes('already taken')) {
            showAuthFeedback('Ce pseudo est déjà pris.', 'error');
          } else {
            showAuthFeedback(data.error || 'Erreur lors de l\'inscription.', 'error');
          }
          return;
        }
        currentUser = {
          id: data.id,
          username: data.username,
          token: data.token
        };
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showAuthFeedback('Compte créé !', 'success');
      } catch (err) {
        console.error('Erreur register :', err);
        showAuthFeedback('Serveur injoignable.', 'error');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      currentUser = null;
      clearCurrentUserFromStorage();
      updateUserUI();
      showAuthFeedback('', '');
    });
  }

  const targetStreetEl = document.getElementById('target-street');
  if (targetStreetEl) {
    targetStreetEl.textContent = '—';
  }

  updateScoreUI();
  updateTimeUI(0, 0);
  updateWeightedScoreUI();
  updateStartStopButton();
  updatePauseButton();
  updateStreetInfoPanelVisibility();
  updateLayoutSessionState();
  updateGameModeControls();
  ensureLectureBackButton();

  // Si le mode est déjà "lecture" au chargement, on lance directement ce mode
  if (getGameMode() === 'lecture') {
    startNewSession();
  } else {
    showMessage(
      'Cliquez sur "Commencer la session" une fois que la carte est chargée.',
      'info'
    );
  }
  const summaryEl = document.getElementById('summary');
  if (summaryEl) {
    summaryEl.classList.add('hidden');
  }

  // La visibilité du skip est gérée par updateStartStopButton()
}

const infoEl = document.getElementById('street-info');
if (infoEl) {
  infoEl.textContent = '';
}

// ------------------------
// Tooltip "Score pondéré" (survol du ?)
// ------------------------
(function initWeightedScoreTooltip() {
  const btn = document.getElementById('weighted-score-help-btn');
  const tip = document.getElementById('weighted-score-help');
  if (!btn || !tip) return;

  // Accessibilité
  if (!tip.id) tip.id = 'weighted-score-help';
  btn.setAttribute('aria-controls', tip.id);
  btn.setAttribute('aria-expanded', 'false');

  const open = () => {
    tip.classList.remove('hidden');      // au cas où
    tip.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    tip.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  };

  const toggle = () => {
    if (tip.classList.contains('is-open')) close();
    else open();
  };

  // Desktop : hover
  btn.addEventListener('mouseenter', open);
  btn.addEventListener('mouseleave', close);
  tip.addEventListener('mouseenter', open);
  tip.addEventListener('mouseleave', close);

  // Clavier : focus
  btn.addEventListener('focus', open);
  btn.addEventListener('blur', close);

  // Mobile/touch : click toggle
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggle();
  });

  // Fermer si clic ailleurs (utile sur mobile)
  document.addEventListener('click', (e) => {
    if (btn.contains(e.target) || tip.contains(e.target)) return;
    close();
  }, true);

  // Fermer avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
})();

// ------------------------
// Boucle d'animation pour les chronos
// ------------------------

function startTimersLoop() {
  function loop() {
    if (sessionStartTime !== null &&
      streetStartTime !== null &&
      isSessionRunning &&
      !isPaused &&
      (currentTarget || currentMonumentTarget)) {

      const now = performance.now();
      const totalTimeSec = (now - sessionStartTime) / 1000;
      const streetTimeSec = (now - streetStartTime) / 1000;

      if (totalTimeSec >= MAX_TIME_SECONDS || streetTimeSec >= MAX_TIME_SECONDS) {
        endSession();
        requestAnimationFrame(loop);
        return;
      }

      if (isChronoMode && chronoEndTime !== null && now >= chronoEndTime) {
        endSession();
        requestAnimationFrame(loop);
        return;
      }

      // Pass chrono remaining for color coding
      const chronoRemaining = (isChronoMode && chronoEndTime !== null)
        ? Math.max(0, (chronoEndTime - now) / 1000)
        : null;
      updateTimeUI(totalTimeSec, streetTimeSec, chronoRemaining);

      // === NOUVEAU : mise à jour dynamique de la barre tant qu'on n'a pas répondu ===
      if (!hasAnsweredCurrentItem) {
        const remainingPoints = computeItemPoints(streetTimeSec); // max(0, 10 - t)
        const ratio = remainingPoints / MAX_POINTS_PER_ITEM;      // 0 → 1
        updateWeightedBar(ratio);
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// ------------------------
// Messages
// ------------------------

function showMessage(text, type) {
  const el = document.getElementById('message');
  if (!el) return;

  el.className = 'message';
  if (type === 'success') el.classList.add('message--success');
  else if (type === 'error') el.classList.add('message--error');
  else el.classList.add('message--info');

  el.textContent = text;
  el.classList.add('message--visible');

  if (messageTimeoutId !== null) {
    clearTimeout(messageTimeoutId);
  }
  messageTimeoutId = setTimeout(() => {
    el.classList.remove('message--visible');
    messageTimeoutId = null;
  }, 3000);
}

// ------------------------
// Chargement des rues
// ------------------------

function getBaseStreetStyleFromName(name) {
  const zoneMode = getZoneMode();
  const nameNorm = normalizeName(name || '');

  let color = '#ffd500';
  let weight = 5;

  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    if (!MAIN_STREET_NAMES.has(nameNorm)) {
      color = '#00000000';
      weight = 0;
    }
  }

  if (zoneMode === 'rues-celebres') {
    if (!FAMOUS_STREET_NAMES.has(nameNorm)) {
      color = '#00000000';
      weight = 0;
    }
  }

  return { color, weight };
}

function getBaseStreetStyle(featureOrLayer) {
  const feature = featureOrLayer.feature || featureOrLayer;
  const name = feature?.properties?.name || '';

  // Style de base selon le mode (ville / rues principales)
  let base = getBaseStreetStyleFromName(name);

  const zoneMode = getZoneMode();
  const selectedQuartier = getSelectedQuartier();
  const featureQuartier = feature?.properties?.quartier || null;

  // → En mode "quartier" : on masque toutes les rues hors quartier sélectionné
  if (zoneMode === 'quartier' && selectedQuartier) {
    if (featureQuartier !== selectedQuartier) {
      base = {
        color: '#00000000', // totalement transparent
        weight: 0
      };
    }
  }

  return base;
}

// Helper : est-ce que cette rue est visible/interactive dans le mode courant ?
function isStreetVisibleInCurrentMode(nameNorm, featureQuartier) {
  const zoneMode = getZoneMode();

  // Mode monuments → aucune rue interactive
  if (zoneMode === 'monuments') return false;

  // Mode rues célèbres → seulement les célèbres
  if (zoneMode === 'rues-celebres') {
    return FAMOUS_STREET_NAMES.has(nameNorm);
  }

  // Mode rues principales → seulement les principales
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    return MAIN_STREET_NAMES.has(nameNorm);
  }

  // Mode quartier → seulement celles du quartier sélectionné
  if (zoneMode === 'quartier') {
    const selectedQuartier = getSelectedQuartier();
    const featQ = typeof featureQuartier === 'string' ? featureQuartier.trim() : null;
    if (selectedQuartier && featQ !== selectedQuartier) {
      return false;
    }
  }

  // Mode ville → toutes visibles
  return true;
}

function addTouchBufferForLayer(baseLayer) {
  if (!IS_TOUCH_DEVICE || !map) return;

  const latlngs = baseLayer.getLatLngs();
  if (!latlngs || latlngs.length === 0) return;

  const buffer = L.polyline(latlngs, {
    color: '#000000',
    weight: 30,        // Épaisseur cliquable (virtuellement large)
    opacity: 0.0,      // Invisible
    interactive: true  // Capte les clics / taps
  });

  // Redirige le clic du buffer vers la vraie couche
  buffer.on('click', (e) => {
    // on évite que le clic remonte
    if (L && L.DomEvent && L.DomEvent.stop) {
      L.DomEvent.stop(e);
    }
    baseLayer.fire('click');
  });

  // Préserve les survols même si on est détecté comme tactile (fenêtre réduite, laptops hybrides)
  buffer.on('mouseover', () => baseLayer.fire('mouseover'));
  buffer.on('mouseout', () => baseLayer.fire('mouseout'));

  buffer.addTo(map);
  baseLayer.touchBuffer = buffer;
}

function loadStreets() {
  const loadStart = performance.now();
  fetch('data/marseille_rues_light.geojson?v=3')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      // Light GeoJSON: already filtered & trimmed by strip_geojson.py
      allStreetFeatures = data.features || [];
      const loadMs = (performance.now() - loadStart).toFixed(0);
      console.log(`Rues chargées : ${allStreetFeatures.length} en ${loadMs}ms`);

      streetLayersById.clear();
      streetLayersByName.clear();
      let idCounter = 0;

      streetsLayer = L.geoJSON(allStreetFeatures, {
        // PLUS DE FILTER : toutes les rues sont chargées, le style gère la visibilité
        style: function (feature) {
          return getBaseStreetStyle(feature);
        },

        onEachFeature: (feature, layer) => {
          const nameNorm = normalizeName(feature.properties.name);

          feature._gameId = idCounter++;
          streetLayersById.set(feature._gameId, layer);
          layer.feature = feature;

          // Indexer par nom pour hover en O(1)
          if (!streetLayersByName.has(nameNorm)) {
            streetLayersByName.set(nameNorm, []);
          }
          streetLayersByName.get(nameNorm).push(layer);

          // Buffer tactile élargi pour les appareils tactiles
          addTouchBufferForLayer(layer);

          let hoverTimer = null;

          layer.on('mouseover', () => {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
              const fq = feature.properties.quartier || null;
              if (!isStreetVisibleInCurrentMode(nameNorm, fq)) return;

              const sameName = streetLayersByName.get(nameNorm) || [];
              sameName.forEach(l => {
                l.setStyle({ weight: 7, color: '#ffffff' });
              });
            }, 50);
          });

          layer.on('mouseout', () => {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
              const fq = feature.properties.quartier || null;
              if (!isStreetVisibleInCurrentMode(nameNorm, fq)) return;

              const sameNameOut = streetLayersByName.get(nameNorm) || [];
              sameNameOut.forEach(l => {
                if (highlightedLayers && highlightedLayers.includes(l)) return;
                const base = getBaseStreetStyle(l);
                l.setStyle({ weight: base.weight, color: base.color });
              });
            }, 50);
          });

          layer.on('click', (e) => {
            const fq = feature.properties.quartier || null;
            if (!isStreetVisibleInCurrentMode(nameNorm, fq)) return;
            handleStreetClick(feature, layer, e);
          });
        }
      }).addTo(map);
      refreshLectureTooltipsIfNeeded();
      populateQuartiers();

      // Force l’application du mode courant une fois les rues effectivement chargées
      const modeSelect = document.getElementById('mode-select');
      if (modeSelect) {
        modeSelect.dispatchEvent(new Event('change'));
      }

      // Petit test mobile
      const isMobile = window.innerWidth <= 900;

      // Version longue uniquement sur desktop/tablette large
      if (!isMobile) {
        showMessage(
          'Carte chargée. Choisissez la zone, le type de partie, puis cliquez sur "Commencer la session".',
          'info'
        );
      }

      // Statut header (texte très court)
      setMapStatus('Carte OK', 'ready');

      // L'appli est prête : on peut appliquer les règles CSS "app-ready"
      document.body.classList.add('app-ready');
    })
    .catch(err => {
      console.error('Erreur lors du chargement des rues :', err);
      showMessage('Erreur de chargement des rues (voir console).', 'error');
      setMapStatus('Erreur', 'error');
    });
}

// ------------------------
// Chargement des monuments
// ------------------------

function loadMonuments() {
  fetch('data/marseille_monuments.geojson?v=2')
    .then(response => {
      if (!response.ok) {
        console.warn('Impossible de charger les monuments (HTTP ' + response.status + ').');
        return null;
      }
      return response.json();
    })
    .then(data => {
      if (!data) return;
      const features = (data.features || []).filter(f =>
        f.geometry &&
        f.geometry.type === 'Point' &&
        f.properties &&
        typeof f.properties.name === 'string' &&
        f.properties.name.trim() !== ''
      );

      allMonuments = features;
      console.log('Nombre de monuments chargés :', allMonuments.length);

      if (allMonuments.length === 0) {
        console.warn('Aucun monument trouvé après filtrage.');
      }

      if (monumentsLayer) {
        map.removeLayer(monumentsLayer);
        monumentsLayer = null;
      }

      monumentsLayer = L.geoJSON(
        { type: 'FeatureCollection', features: allMonuments },
        {
          renderer: L.svg({ pane: 'markerPane' }),  // markerPane (z-600) au-dessus du canvas (z-400)
          pointToLayer: (feature, latlng) => {
            const marker = L.circleMarker(latlng, {
              radius: 8,
              color: '#e3f2fd',
              weight: 3,
              fillColor: '#90caf9',
              fillOpacity: 1.0,
              pane: 'markerPane'
            });
            // On touch devices, add an invisible larger hit area
            if (IS_TOUCH_DEVICE) {
              marker._monumentFeature = feature;
            }
            return marker;
          },
          onEachFeature: (feature, layer) => {
            layer.on('click', () => handleMonumentClick(feature, layer));
          }
        }
      );

      // Add invisible hit areas after layer is created (can't add during construction)
      if (IS_TOUCH_DEVICE && monumentsLayer) {
        monumentsLayer.eachLayer(layer => {
          const feat = layer._monumentFeature;
          if (!feat) return;
          const latlng = layer.getLatLng();
          const hitArea = L.circleMarker(latlng, {
            radius: 18,
            fillOpacity: 0,
            opacity: 0,
            pane: 'markerPane'
          });
          hitArea.on('click', () => handleMonumentClick(feat, layer));
          hitArea._visibleMarker = layer;  // link back to visible marker
          hitArea._isHitArea = true;
          monumentsLayer.addLayer(hitArea);
        });
      }
      refreshLectureTooltipsIfNeeded();

      // Si la zone active est déjà "monuments", on ajoute directement le layer
      const currentMode = getZoneMode();
      if (currentMode === 'monuments') {
        if (!map.hasLayer(monumentsLayer)) {
          monumentsLayer.addTo(map);
        }
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
      }
    })
    .catch(err => {
      console.error('Erreur lors du chargement des monuments :', err);
    });
}

// ------------------------
// Tooltips du mode lecture
// ------------------------

function setLectureTooltipsEnabled(enabled) {
  // helper: attache/retire le comportement "tap => tooltip"
  function attachTapTooltip(layer) {
    if (!IS_TOUCH_DEVICE) return;

    // éviter les doublons
    if (layer.__lectureTapTooltipBound) return;
    layer.__lectureTapTooltipBound = true;

    layer.on('click', layer.__lectureTapTooltipFn = () => {
      // ouvre le tooltip du layer tapé
      if (layer.getTooltip()) layer.openTooltip();

      // option: fermer les autres tooltips pour éviter l’empilement
      if (streetsLayer) {
        streetsLayer.eachLayer(l => {
          if (l !== layer && l.getTooltip && l.getTooltip()) l.closeTooltip();
        });
      }
      if (monumentsLayer) {
        monumentsLayer.eachLayer(l => {
          if (l !== layer && l.getTooltip && l.getTooltip()) l.closeTooltip();
        });
      }
    });
  }

  function detachTapTooltip(layer) {
    if (!layer.__lectureTapTooltipBound) return;
    if (layer.__lectureTapTooltipFn) {
      layer.off('click', layer.__lectureTapTooltipFn);
    }
    layer.__lectureTapTooltipBound = false;
    layer.__lectureTapTooltipFn = null;
  }

  // RUES
  if (streetsLayer) {
    streetsLayer.eachLayer(layer => {
      const name = layer.feature?.properties?.name || '';
      if (!name) return;

      if (enabled) {
        // Only bind if visible in current mode
        const base = getBaseStreetStyle(layer);
        const isVisible = base.weight > 0;

        if (isVisible) {
          if (!layer.getTooltip()) {
            layer.bindTooltip(name, {
              direction: 'top',
              sticky: !IS_TOUCH_DEVICE,  // hover desktop
              opacity: 0.9,
              className: 'street-tooltip'
            });
          }
          attachTapTooltip(layer);
        } else {
          // Unbind if hidden
          if (layer.getTooltip()) layer.unbindTooltip();
          detachTapTooltip(layer);
        }
      } else {
        detachTapTooltip(layer);
        if (layer.getTooltip()) {
          layer.closeTooltip();
          layer.unbindTooltip();
        }
      }
    });
  }

  // MONUMENTS
  if (monumentsLayer) {
    monumentsLayer.eachLayer(layer => {
      // Skip hit areas — they don't need tooltips themselves
      if (layer._isHitArea) {
        // But bind a tap handler that toggles tooltip on the visible marker
        if (enabled && IS_TOUCH_DEVICE && !layer.__hitAreaTooltipBound) {
          layer.__hitAreaTooltipBound = true;
          layer.on('click', () => {
            const visMarker = layer._visibleMarker;
            if (visMarker && visMarker.getTooltip()) {
              // Close all other tooltips
              monumentsLayer.eachLayer(l => {
                if (l !== visMarker && l.getTooltip && l.getTooltip()) l.closeTooltip();
              });
              visMarker.toggleTooltip();
            }
          });
        } else if (!enabled) {
          layer.__hitAreaTooltipBound = false;
        }
        return;
      }

      const name = layer.feature?.properties?.name || '';
      if (!name) return;

      if (enabled) {
        if (!layer.getTooltip()) {
          layer.bindTooltip(name, {
            direction: 'top',
            sticky: false,
            permanent: false,
            opacity: 0.9,
            className: 'monument-tooltip'
          });
        }

        // On touch devices, also bind tap on the visible marker itself
        if (IS_TOUCH_DEVICE && !layer.__monumentTapBound) {
          layer.__monumentTapBound = true;
          layer.on('click', () => {
            monumentsLayer.eachLayer(l => {
              if (l !== layer && l.getTooltip && l.getTooltip()) l.closeTooltip();
            });
            if (layer.getTooltip()) layer.toggleTooltip();
          });
        }
      } else {
        if (layer.__monumentTapBound) {
          layer.__monumentTapBound = false;
        }
        if (layer.getTooltip()) {
          layer.closeTooltip();
          layer.unbindTooltip();
        }
      }
    });
  }
}

function refreshLectureTooltipsIfNeeded() {
  const gm = getGameMode();
  if (gm === 'lecture' || isLectureMode === true) {
    setLectureTooltipsEnabled(true);
  }
}

// ------------------------
// Chargement des quartiers
// ------------------------

function loadQuartierPolygons() {
  fetch('data/marseille_quartiers_111.geojson?v=2')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      const features = data.features || [];
      quartierPolygonsByName.clear();

      features.forEach(f => {
        const props = f.properties || {};
        const name = typeof props.nom_qua === 'string' ? props.nom_qua.trim() : '';
        if (name) {
          quartierPolygonsByName.set(name, f);
        }
      });

      console.log('Quartiers chargés :', quartierPolygonsByName.size);
      console.log('Noms de quartiers (polygones):');
      console.log(Array.from(quartierPolygonsByName.keys()).sort());
    })
    .catch(err => {
      console.error('Erreur lors du chargement des quartiers :', err);
    });
}

// ------------------------
// Gestion visuelle du quartier
// ------------------------

function highlightQuartier(quartierName) {
  clearQuartierOverlay();
  if (!quartierName) return;

  const feature = quartierPolygonsByName.get(quartierName);
  if (!feature) {
    console.warn('Aucun polygone trouvé pour le quartier :', quartierName);
    return;
  }

  quartierOverlay = L.geoJSON(feature, {
    style: {
      color: '#0077ff',
      weight: 2,
      fill: false
    },
    interactive: false
  }).addTo(map);

  const bounds = quartierOverlay.getBounds();
  if (bounds && bounds.isValid && bounds.isValid()) {
    const isMobile = window.innerWidth <= 900;

    const fitOptions = isMobile
      ? { padding: [40, 40], maxZoom: 14 } // ← limite le zoom en mode quartier sur mobile
      : { padding: [40, 40] };             // ← desktop : comportement inchangé

    map.fitBounds(bounds, { ...fitOptions, animate: true, duration: 1.5 });
  }
}

function clearQuartierOverlay() {
  if (quartierOverlay) {
    map.removeLayer(quartierOverlay);
    quartierOverlay = null;
  }
}

// ------------------------
// Liste des quartiers (UI)
// ------------------------

function populateQuartiers() {
  const quartierSelect = document.getElementById('quartier-select');
  const quartierList = document.getElementById('quartier-select-list');
  const quartierBtn = document.getElementById('quartier-select-button');
  const quartierLabel = quartierBtn
    ? quartierBtn.querySelector('.custom-select-label')
    : null;

  if (!quartierSelect) return;

  const setQuartiers = new Set();

  allStreetFeatures.forEach(f => {
    const props = f.properties || {};
    const q = props.quartier;
    if (typeof q === 'string' && q.trim() !== '') {
      setQuartiers.add(q.trim());
    }
  });

  const quartiers = Array.from(setQuartiers).sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );

  // Remplir le <select> caché
  quartierSelect.innerHTML = '';
  quartiers.forEach(q => {
    const opt = document.createElement('option');
    opt.value = q;
    opt.textContent = q;
    quartierSelect.appendChild(opt);
  });

  // Remplir la liste du faux select
  if (quartierList) {
    quartierList.innerHTML = '';
    quartiers.forEach(q => {
      const li = document.createElement('li');
      li.dataset.value = q;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = q;
      li.appendChild(nameSpan);

      const arrLabel = arrondissementByQuartier.get(normalizeQuartierKey(q));
      if (arrLabel) {
        const pill = document.createElement('span');
        pill.className = 'difficulty-pill difficulty-pill--arrondissement';
        pill.textContent = arrLabel;
        li.appendChild(pill);
      }

      li.addEventListener('click', () => {
        if (quartierLabel) quartierLabel.textContent = q;
        const liPill = li.querySelector('.difficulty-pill');
        if (quartierBtn) {
          const btnPill = quartierBtn.querySelector('.difficulty-pill');
          if (liPill) {
            const newPill = liPill.cloneNode(true);
            if (btnPill) btnPill.replaceWith(newPill);
            else quartierBtn.appendChild(newPill);
          } else if (btnPill) {
            btnPill.remove();
          }
        }
        quartierSelect.value = q;
        quartierSelect.dispatchEvent(new Event('change'));
        quartierList.classList.remove('visible');
      });
      quartierList.appendChild(li);
    });

    if (quartiers.length > 0 && quartierBtn) {
      const q0 = quartiers[0];
      if (quartierLabel) quartierLabel.textContent = q0;
      const arrLabel0 = arrondissementByQuartier.get(normalizeQuartierKey(q0));
      if (arrLabel0) {
        const existingPill = quartierBtn.querySelector('.difficulty-pill');
        const newPill = document.createElement('span');
        newPill.className = 'difficulty-pill difficulty-pill--arrondissement';
        newPill.textContent = arrLabel0;
        if (existingPill) existingPill.replaceWith(newPill);
        else quartierBtn.appendChild(newPill);
      }
      quartierSelect.value = q0;
    }
  }
}

// ------------------------
// Gestion de session
// ------------------------

function scrollSidebarToTargetPanel() {
  // Seulement sur mobile
  if (window.innerWidth >= 900) return;

  const sidebar = document.getElementById('sidebar');
  const targetPanel = document.querySelector('.target-panel');
  if (!sidebar || !targetPanel) return;

  // On attend que le DOM et la transition CSS (layout mobile) se stabilisent
  setTimeout(() => {
    const panelTop = targetPanel.offsetTop;
    const panelHeight = targetPanel.offsetHeight;
    const sidebarHeight = sidebar.clientHeight;

    const scrollTarget = panelTop - (sidebarHeight / 2) + (panelHeight / 2);

    sidebar.scrollTo({
      top: scrollTarget,
      behavior: 'smooth'
    });
  }, 350); // délai idéal : permet au layout mobile d'appliquer min-height/max-height
}

function ensureLectureBackButton() {
  // Ne pas dupliquer le bouton
  if (document.getElementById('lecture-back-btn')) return;
  const targetPanel = document.querySelector('.target-panel');

  if (!targetPanel) return;

  const btn = document.createElement('button');
  btn.id = 'lecture-back-btn';
  btn.type = 'button';
  btn.className = 'btn btn-secondary lecture-back-btn';
  btn.textContent = 'Retour au menu';

  // Juste après le panneau "Rue à trouver"
  targetPanel.insertAdjacentElement('afterend', btn);

  // Action : sortir du mode lecture et revenir au menu
  btn.addEventListener('click', exitLectureModeToMenu);

  // Par défaut, caché (géré ensuite dans updateLayoutSessionState)
  btn.style.display = 'none';
}

function exitLectureModeToMenu() {
  // Désactivation du mode lecture
  isLectureMode = false;
  setLectureTooltipsEnabled(false);

  // Aucune session en cours
  isSessionRunning = false;
  isChronoMode = false;
  chronoEndTime = null;
  sessionStartTime = null;
  streetStartTime = null;
  isPaused = false;
  pauseStartTime = null;
  remainingChronoMs = null;

  // Remet le mode de jeu sur "classique" côté logique
  const gameModeSelect = document.getElementById('game-mode-select');
  if (gameModeSelect) {
    gameModeSelect.value = 'classique';
  }

  // Met à jour le sélecteur custom
  const gameModeBtn = document.getElementById('game-mode-select-button');
  const gameModeList = document.getElementById('game-mode-select-list');
  if (gameModeBtn && gameModeList) {
    const label = gameModeBtn.querySelector('.custom-select-label');
    const item = gameModeList.querySelector('li[data-value="classique"]');
    if (label && item) {
      label.textContent = item.childNodes[0].textContent.trim();
      const pillInList = item.querySelector('.difficulty-pill');
      if (pillInList) {
        const newPill = pillInList.cloneNode(true);
        const btnPill = gameModeBtn.querySelector('.difficulty-pill');
        if (btnPill) btnPill.replaceWith(newPill);
        else gameModeBtn.appendChild(newPill);
      }
    }
  }
  // Réinitialise les infos de cible / temps
  const targetStreetEl = document.getElementById('target-street');
  if (targetStreetEl) {
    targetStreetEl.textContent = '—';
  }
  updateTimeUI(0, 0);

  updateStartStopButton();
  updatePauseButton();
  updateGameModeControls();
  updateLayoutSessionState();

  showMessage('Retour au menu.', 'info');
}

function startNewSession() {
  const quartierSelect = document.getElementById('quartier-select');
  const zoneMode = getZoneMode();
  const gameMode = getGameMode();
  const infoEl = document.getElementById('street-info');
  if (infoEl) {
    if (zoneMode === 'rues-principales' || zoneMode === 'main') {
      // On repart propre : masqué tant qu’aucune rue principale n’a été cliquée
      infoEl.textContent = '';
      infoEl.style.display = 'none';
    } else {
      infoEl.textContent = '';
      infoEl.style.display = 'none';
    }
  }

  clearHighlight();

  // Reset états communs
  correctCount = 0;
  totalAnswered = 0;
  summaryData = [];
  weightedScore = 0;
  errorsCount = 0;

  isPaused = false;
  pauseStartTime = null;
  remainingChronoMs = null;

  updateScoreUI();
  updateTimeUI(0, 0);
  updateWeightedScoreUI();
  const summaryEl = document.getElementById('summary');
  if (summaryEl) {
    summaryEl.classList.add('hidden');
  }

  isChronoMode = (gameMode === 'chrono');
  if (isChronoMode) {
    chronoEndTime = performance.now() + CHRONO_DURATION * 1000;
  } else {
    chronoEndTime = null;
  }
  // Par défaut, on coupe les tooltips (sauf si mode lecture plus bas)
  setLectureTooltipsEnabled(false);

  // --------- MODE LECTURE (aucun chrono, aucune cible, seulement survol) ---------
  if (gameMode === 'lecture') {
    isLectureMode = true;
    isSessionRunning = false;
    isChronoMode = false;
    chronoEndTime = null;
    sessionStartTime = null;
    streetStartTime = null;
    currentTarget = null;
    setLectureTooltipsEnabled(true);
    currentMonumentTarget = null;
    isPaused = false;
    pauseStartTime = null;
    remainingChronoMs = null;

    // Met à jour la classe sur le <body> (layout session / non-session)
    updateLayoutSessionState();

    // — Couches —
    if (zoneMode === 'monuments') {
      if (streetsLayer && map.hasLayer(streetsLayer)) {
        map.removeLayer(streetsLayer);
      }
      if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
        monumentsLayer.addTo(map);
      }
      clearQuartierOverlay();
    } else {
      if (monumentsLayer && map.hasLayer(monumentsLayer)) {
        map.removeLayer(monumentsLayer);
      }
      if (streetsLayer && !map.hasLayer(streetsLayer)) {
        streetsLayer.addTo(map);
      }

      if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
        highlightQuartier(quartierSelect.value);
      } else {
        clearQuartierOverlay();
      }
    }

    // — UI —
    if (targetStreetEl) {
      targetStreetEl.textContent = 'Mode lecture : survolez la carte';
      requestAnimationFrame(fitTargetStreetText);
    }

    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.textContent = 'Pause';
    }

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
      skipBtn.style.display = 'none';
    }

    // Bouton start/stop + pause → cachés en mode lecture
    updateStartStopButton();
    updatePauseButton();
    updateTimeUI(0, 0);

    // Tooltips sur rues / monuments
    setLectureTooltipsEnabled(true);

    showMessage('Mode lecture : survolez les rues ou monuments pour voir leurs noms.', 'info');
    return;
  }

  // --------- MODE MONUMENTS ---------
  isLectureMode = false;
  if (zoneMode === 'monuments') {
    if (!allMonuments.length) {
      showMessage('Aucun monument disponible (vérifiez data/marseille_monuments.geojson).', 'error');
      return;
    }

    if (streetsLayer && map.hasLayer(streetsLayer)) {
      map.removeLayer(streetsLayer);
    }
    if (monumentsLayer && !map.hasLayer(monumentsLayer)) {
      monumentsLayer.addTo(map);
    }
    clearQuartierOverlay();

    if (gameMode === 'marathon') {
      sessionMonuments = sampleWithoutReplacement(allMonuments, allMonuments.length);
    } else if (gameMode === 'chrono') {
      sessionMonuments = sampleWithoutReplacement(allMonuments, allMonuments.length);
    } else {
      const n = Math.min(SESSION_SIZE, allMonuments.length);
      sessionMonuments = sampleWithoutReplacement(allMonuments, n);
    }

    currentMonumentIndex = 0;
    currentMonumentTarget = null;
    currentTarget = null;
    isMonumentsMode = true;

    sessionStartTime = performance.now();
    streetStartTime = null;
    isSessionRunning = true;
    updateStartStopButton();
    updatePauseButton();
    updateLayoutSessionState();
    scrollSidebarToTargetPanel();

    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.style.display = 'inline-block';

    setNewTarget();
    showMessage('Session monuments démarrée.', 'info');

    updateLayoutSessionState();

    return;
  }

  // --------- MODES RUES ---------
  isLectureMode = false;
  isMonumentsMode = false;

  if (allStreetFeatures.length === 0) {
    showMessage('Impossible de démarrer : données rues non chargées.', 'error');
    return;
  }

  const candidates = getCurrentZoneStreets();
  if (candidates.length === 0) {
    showMessage('Aucune rue disponible pour cette zone.', 'error');
    return;
  }

  const uniqueStreets = buildUniqueStreetList(candidates);
  if (uniqueStreets.length === 0) {
    showMessage('Aucune rue nommée disponible pour cette zone.', 'error');
    return;
  }

  if (gameMode === 'marathon') {
    sessionStreets = sampleWithoutReplacement(uniqueStreets, uniqueStreets.length);
  } else if (gameMode === 'chrono') {
    sessionStreets = sampleWithoutReplacement(uniqueStreets, uniqueStreets.length);
  } else {
    const n = Math.min(SESSION_SIZE, uniqueStreets.length);
    sessionStreets = sampleWithoutReplacement(uniqueStreets, n);
  }

  currentIndex = 0;

  if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
    highlightQuartier(quartierSelect.value);
  } else {
    clearQuartierOverlay();
  }

  if (monumentsLayer && map.hasLayer(monumentsLayer)) {
    map.removeLayer(monumentsLayer);
  }
  if (streetsLayer && !map.hasLayer(streetsLayer)) {
    streetsLayer.addTo(map);
  }

  sessionStartTime = performance.now();
  currentTarget = null;
  currentMonumentTarget = null;
  streetStartTime = null;

  isSessionRunning = true;
  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();
  scrollSidebarToTargetPanel();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn && !isLectureMode) skipBtn.style.display = 'inline-block';

  setNewTarget();
  showMessage('Session démarrée.', 'info');
}

// Récupère la liste de rues candidates selon la zone choisie
function getCurrentZoneStreets() {
  const quartierSelect = document.getElementById('quartier-select');
  const zoneMode = getZoneMode();

  if (zoneMode === 'quartier' && quartierSelect && quartierSelect.value) {
    const targetQuartier = quartierSelect.value;
    return allStreetFeatures.filter(f =>
      f.properties &&
      typeof f.properties.quartier === 'string' &&
      f.properties.quartier === targetQuartier
    );
  }

  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    return allStreetFeatures.filter(f => {
      const nm = normalizeName(f.properties && f.properties.name);
      return MAIN_STREET_NAMES.has(nm);
    });
  }

  if (zoneMode === 'rues-celebres') {
    return allStreetFeatures.filter(f => {
      const nm = normalizeName(f.properties && f.properties.name);
      return FAMOUS_STREET_NAMES.has(nm);
    });
  }

  return allStreetFeatures;
}

// Construit une liste de rues uniques
function buildUniqueStreetList(features) {
  const byName = new Map();

  features.forEach(f => {
    const rawName = typeof f.properties.name === 'string'
      ? f.properties.name.trim()
      : '';
    if (!rawName) return;
    const key = normalizeName(rawName);
    if (!byName.has(key)) {
      byName.set(key, f);
    }
  });

  return Array.from(byName.values());
}

// Tirage sans remise
function sampleWithoutReplacement(array, n) {
  const indices = Array.from(array.keys());
  shuffle(indices);
  return indices.slice(0, n).map(i => array[i]);
}

// Mélange en place
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ------------------------
// Sélection de la cible suivante (rue ou monument)
// ------------------------

function setNewTarget() {
  const gameMode = getGameMode();
  const zoneMode = getZoneMode();

  // Monuments
  if (zoneMode === 'monuments') {
    if (currentMonumentIndex >= sessionMonuments.length) {
      if (gameMode === 'chrono') {
        shuffle(sessionMonuments);
        currentMonumentIndex = 0;
      } else {
        endSession();
        return;
      }
    }

    currentTarget = null;
    currentMonumentTarget = sessionMonuments[currentMonumentIndex];
    streetStartTime = performance.now();
    hasAnsweredCurrentItem = false;
    resetWeightedBar();

    const targetName = currentMonumentTarget.properties.name;
    const targetEl = document.getElementById('target-street');
    if (targetEl) {
      targetEl.textContent = targetName || '—';
      requestAnimationFrame(fitTargetStreetText);
    }


    triggerTargetPulse();
    return;
  }

  // Rues
  if (currentIndex >= sessionStreets.length) {
    if (gameMode === 'chrono') {
      shuffle(sessionStreets);
      currentIndex = 0;
    } else {
      endSession();
      return;
    }
  }

  currentMonumentTarget = null;
  currentTarget = sessionStreets[currentIndex];
  streetStartTime = performance.now();
  hasAnsweredCurrentItem = false;
  resetWeightedBar();

  const targetName = currentTarget.properties.name;
  const targetEl = document.getElementById('target-street');
  if (targetEl) {
    targetEl.textContent = targetName || '—';
    requestAnimationFrame(fitTargetStreetText);
  }

  triggerTargetPulse();
}

// Animation panneau "Rue à trouver"
function triggerTargetPulse() {
  const panel = document.querySelector('.target-panel');
  if (!panel) return;
  panel.classList.remove('pulse');
  void panel.offsetWidth;
  panel.classList.add('pulse');
}

// ------------------------
// Start / Stop + Pause
// ------------------------

function updateStartStopButton() {
  const btn = document.getElementById('restart-btn');
  const skipBtn = document.getElementById('skip-btn');
  if (!btn) return;

  const gameMode = getGameMode();

  // En mode lecture : bouton totalement caché
  if (gameMode === 'lecture') {
    btn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
    return;
  } else {
    btn.style.display = '';
  }

  if (isSessionRunning) {
    btn.textContent = 'Arrêter la session';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-stop');
    if (skipBtn) skipBtn.style.display = '';
  } else {
    btn.textContent = 'Commencer la session';
    btn.classList.remove('btn-stop');
    btn.classList.add('btn-primary');
    if (skipBtn) skipBtn.style.display = 'none';
  }
}

function stopSessionManually() {
  if (!isSessionRunning && !isDailyMode) return;
  // In daily mode, use dedicated handler
  if (typeof handleDailyStop === 'function' && handleDailyStop()) return;
  endSession();
}

function togglePause() {
  if (!isSessionRunning) return;

  if (!isPaused) {
    // Mise en pause
    isPaused = true;
    pauseStartTime = performance.now();

    if (isChronoMode && chronoEndTime !== null) {
      remainingChronoMs = chronoEndTime - pauseStartTime;
    }
  } else {
    // Reprise
    const now = performance.now();
    const pausedDelta = now - pauseStartTime;

    if (sessionStartTime !== null) {
      sessionStartTime += pausedDelta;
    }
    if (streetStartTime !== null) {
      streetStartTime += pausedDelta;
    }

    if (isChronoMode && remainingChronoMs !== null) {
      chronoEndTime = now + remainingChronoMs;
      remainingChronoMs = null;
    }

    isPaused = false;
    pauseStartTime = null;
  }

  updatePauseButton();
}

function updatePauseButton() {
  const pauseBtn = document.getElementById('pause-btn');
  if (!pauseBtn) return;

  const gameMode = getGameMode();

  // En mode lecture : bouton totalement caché
  if (gameMode === 'lecture') {
    pauseBtn.style.display = 'none';
    return;
  }

  if (!isSessionRunning) {
    pauseBtn.style.display = 'none';
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    return;
  }

  pauseBtn.style.display = '';

  pauseBtn.disabled = false;
  pauseBtn.textContent = isPaused ? 'Reprendre' : 'Pause';
}

function updateLayoutSessionState() {
  const body = document.body;
  if (!body) return;

  const hasMapLayout = isSessionRunning || isLectureMode;

  if (hasMapLayout) body.classList.add('session-running');
  else body.classList.remove('session-running');

  if (isLectureMode) body.classList.add('lecture-mode');
  else body.classList.remove('lecture-mode');

  if (map) {
    setTimeout(() => map.invalidateSize(), 300);
  }

  // Centrage auto du panneau cible en mode lecture (mobile)
  if (isLectureMode) {
    const sidebar = document.getElementById('sidebar');
    const targetPanel = document.querySelector('.target-panel');

    if (sidebar && targetPanel) {
      setTimeout(() => {
        sidebar.scrollTo({
          top: targetPanel.offsetTop - 8,
          behavior: 'smooth'
        });
      }, 120);
    }
  }

  // Affichage du bouton "Retour au menu" uniquement en mode lecture + mobile
  const backBtn = document.getElementById('lecture-back-btn');
  if (backBtn) {
    const isMobile = window.innerWidth <= 900;

    if (isLectureMode && isMobile) {
      backBtn.style.display = 'block';

      // >>> AJOUT MINIMAL : focus uniquement ici (lecture + mobile)
      if (!backBtn.__didAutoFocus) {
        backBtn.__didAutoFocus = true;

        // Attendre que display + layout + scroll soient stables
        setTimeout(() => {
          try {
            backBtn.focus({ preventScroll: true });
          } catch (_) {
            backBtn.focus();
          }
        }, 200);
      }
    } else {
      backBtn.style.display = 'none';
      backBtn.__didAutoFocus = false; // reset quand on sort du mode/du mobile
    }
  }
}

// ------------------------
// Gestion des clics sur les rues
// ------------------------

function computeItemPoints(elapsedSeconds) {
  return Math.max(0, MAX_POINTS_PER_ITEM - elapsedSeconds);
}

function handleStreetClick(clickedFeature, clickedLayer, event) {
  const zoneMode = getZoneMode();

  if (zoneMode === 'monuments') return;

  // En mode "rues principales" : on ignore les rues non principales
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    const nameNorm = normalizeName(clickedFeature.properties.name);
    if (!MAIN_STREET_NAMES.has(nameNorm)) {
      return;
    }
  }

  // En mode "Rues Célèbres"
  if (zoneMode === 'rues-celebres') {
    const nameNorm = normalizeName(clickedFeature.properties.name);
    if (!FAMOUS_STREET_NAMES.has(nameNorm)) {
      return;
    }
  }

  // En mode "quartier" : on ignore les rues hors quartier
  if (zoneMode === 'quartier') {
    const selectedQuartier = getSelectedQuartier();
    const featQ = (clickedFeature.properties && typeof clickedFeature.properties.quartier === 'string')
      ? clickedFeature.properties.quartier.trim()
      : null;
    if (selectedQuartier && featQ !== selectedQuartier) {
      return;
    }
  }

  if (isPaused) return;

  // >>> MODE DÉFI QUOTIDIEN <<<
  if (isDailyMode) {
    if (!dailyTargetData || !dailyTargetGeoJson) return;

    // Bloquer si le défi est déjà terminé (victoire ou 7 essais)
    const status = dailyTargetData.userStatus || {};
    if (status.success || (status.attempts_count || 0) >= 7 || window._dailyGameOver) return;

    // Empêcher les clics rapides pendant que le serveur traite
    if (window._dailyGuessInFlight) return;
    window._dailyGuessInFlight = true;

    // Compare street names
    const clickedName = normalizeName(clickedFeature.properties.name);
    const targetName = normalizeName(dailyTargetData.streetName);
    const isSuccess = (clickedName === targetName);

    // Calculate distance and direction
    let distance = 0;
    let arrow = '';
    const clickedCentroid = computeFeatureCentroid(clickedFeature);
    const targetCentroid = dailyTargetGeoJson; // [lon, lat]

    if (!isSuccess) {
      // Find true clicked position
      let clickLon = clickedCentroid[0];
      let clickLat = clickedCentroid[1];
      if (event && event.latlng) {
        clickLon = event.latlng.lng;
        clickLat = event.latlng.lat;
      }

      // 1. Point-to-line true distance checking target street polyline
      const targetNameNorm = normalizeName(dailyTargetData.streetName);
      const targetFeature = allStreetFeatures.find(f => f.properties && normalizeName(f.properties.name) === targetNameNorm);

      if (targetFeature && targetFeature.geometry) {
        distance = getDistanceToFeature(clickLat, clickLon, targetFeature.geometry);
      } else {
        // Fallback to centroid logic
        distance = getDistanceMeters(clickLat, clickLon, targetCentroid[1], targetCentroid[0]);
      }

      // 2. Broad direction
      arrow = getDirectionArrow(clickedCentroid, targetCentroid);
    }

    // Flash wrong street on map
    if (!isSuccess && clickedLayer && typeof clickedLayer.setStyle === 'function') {
      const origStyle = getBaseStreetStyle(clickedLayer);
      clickedLayer.setStyle({ color: '#f97316', weight: 6, opacity: 1 });
      setTimeout(() => {
        if (clickedLayer && map.hasLayer(clickedLayer)) {
          clickedLayer.setStyle(origStyle);
        }
      }, 2000);
    }

    // ── 1. Enregistrer la tentative LOCALEMENT (avant même d'appeler le serveur) ──
    dailyGuessHistory.push({
      streetName: clickedFeature.properties.name,
      distance: Math.round(distance),
      arrow
    });
    saveDailyGuessesToStorage();

    const localAttempts = dailyGuessHistory.length;
    const localRemaining = 7 - localAttempts;

    // ── 2. Fin de partie côté client (immédiat, pas besoin du serveur) ──
    if (isSuccess) {
      // === VICTOIRE ===
      window._dailyGameOver = true;
      isSessionRunning = false;
      showMessage(`🎉 BRAVO ! Trouvé en ${localAttempts} essai${localAttempts > 1 ? 's' : ''} !`, 'success');
      renderDailyGuessHistory({ success: true, attempts: localAttempts });

      const titleEl = document.getElementById('target-panel-title');
      if (titleEl) titleEl.textContent = '🎉 Défi réussi !';

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) {
        restartBtn.textContent = 'Commencer la session';
        restartBtn.classList.remove('btn-stop');
        restartBtn.classList.add('btn-primary');
      }

      // Mettre en évidence la rue cible sur la carte
      const targetNameNorm = normalizeName(dailyTargetData.streetName);
      const targetFeature = allStreetFeatures.find(f => f.properties && normalizeName(f.properties.name) === targetNameNorm);
      if (targetFeature && targetFeature.geometry) {
        highlightDailyTarget(targetFeature.geometry, true);
      }

    } else if (localRemaining <= 0) {
      // === ÉCHEC : 7 essais épuisés ===
      window._dailyGameOver = true;
      isSessionRunning = false;
      showMessage(`❌ Dommage ! C'était « ${dailyTargetData.streetName} ». Fin du défi.`, 'error');
      renderDailyGuessHistory({ success: false });

      const titleEl = document.getElementById('target-panel-title');
      if (titleEl) titleEl.textContent = '❌ Défi échoué';

      const restartBtn = document.getElementById('restart-btn');
      if (restartBtn) {
        restartBtn.textContent = 'Commencer la session';
        restartBtn.classList.remove('btn-stop');
        restartBtn.classList.add('btn-primary');
      }

      // Mettre en évidence la rue cible sur la carte
      const targetNameNorm = normalizeName(dailyTargetData.streetName);
      const targetFeature = allStreetFeatures.find(f => f.properties && normalizeName(f.properties.name) === targetNameNorm);
      if (targetFeature && targetFeature.geometry) {
        highlightDailyTarget(targetFeature.geometry, false);
      }

    } else {
      // === Essai raté, encore des essais restants ===
      renderDailyGuessHistory();
      const distStr = distance >= 1000
        ? `${(distance / 1000).toFixed(1)} km`
        : `${Math.round(distance)} m`;
      showMessage(`❌ Raté ! Distance : ${distStr}. Plus que ${localRemaining} essai${localRemaining > 1 ? 's' : ''}.`, 'warning');
    }

    updateDailyUI();
    updateStartStopButton();
    updateLayoutSessionState();

    // ── 3. Synchroniser avec le serveur EN ARRIÈRE-PLAN (non bloquant) ──
    fetch(API_URL + '/api/daily/guess', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({
        date: dailyTargetData.date,
        distanceMeters: Math.round(distance),
        isSuccess
      })
    }).then(r => r.json()).then(result => {
      // Mettre à jour le statut serveur local (pour la prochaine visite)
      dailyTargetData.userStatus = result;

      // Si le serveur renvoie la géométrie cible, la surligner (si pas déjà fait)
      if (result.targetGeometry && (result.success || result.attempts_count >= 7)) {
        highlightDailyTarget(result.targetGeometry, !!result.success);
      }
    }).catch(err => {
      console.warn('Daily sync error (non-bloquant):', err);
    }).finally(() => {
      window._dailyGuessInFlight = false;
    });

    return; // Stop normal logic
  }

  if (!currentTarget || sessionStartTime === null || streetStartTime === null) {
    return;
  }

  const gameMode = getGameMode();
  const now = performance.now();
  const streetTimeSec = (now - streetStartTime) / 1000;

  const clickedName = normalizeName(clickedFeature.properties.name);
  const targetNameNorm = normalizeName(currentTarget.properties.name);

  const isCorrect = (clickedName === targetNameNorm);
  const answeredFeature = currentTarget;

  if (isCorrect) {
    correctCount += 1;
    const points = computeItemPoints(streetTimeSec);
    weightedScore += points;
    updateWeightedScoreUI();
    updateWeightedBar(points / 10);
    hasAnsweredCurrentItem = true;

    showMessage(
      `Correct (${streetTimeSec.toFixed(1)} s, +${points.toFixed(1)} pts)`,
      'success'
    );
    highlightStreet('#00aa00');
    feedbackCorrect();
  } else {
    errorsCount += 1;
    if (gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
      showMessage(
        `Incorrect (limite de ${MAX_ERRORS_MARATHON} erreurs atteinte)`,
        'error'
      );
    } else {
      showMessage('Incorrect', 'error');
    }
    highlightStreet('#d00');
    updateWeightedBar(0);
    feedbackError();
  }

  totalAnswered += 1;
  summaryData.push({
    name: currentTarget.properties.name,
    correct: isCorrect,
    time: streetTimeSec.toFixed(1)
  });

  // Analytics tracking (fire-and-forget)
  trackAnswer(currentTarget.properties.name, getZoneMode(), isCorrect, streetTimeSec);

  updateScoreUI();

  // Infos historiques pour rues principales
  showStreetInfo(answeredFeature);

  if (!isCorrect && gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
    endSession();
    return;
  }

  currentIndex += 1;
  setNewTarget();
}

// ------------------------
// Gestion des clics sur les monuments
// ------------------------

function handleMonumentClick(clickedFeature, clickedLayer) {
  const zoneMode = getZoneMode();
  if (zoneMode !== 'monuments') return;
  if (isPaused) return;

  if (!currentMonumentTarget || sessionStartTime === null || streetStartTime === null) {
    return;
  }

  const gameMode = getGameMode();
  const now = performance.now();
  const itemTimeSec = (now - streetStartTime) / 1000;

  const clickedName = normalizeName(clickedFeature.properties.name);
  const targetNameNorm = normalizeName(currentMonumentTarget.properties.name);

  const isCorrect = (clickedName === targetNameNorm);
  const answeredName = currentMonumentTarget.properties.name;

  // On récupère toujours le layer correspondant au monument CIBLE
  const correctLayer = findMonumentLayerByName(
    currentMonumentTarget.properties.name
  );

  if (isCorrect) {
    correctCount += 1;
    const points = computeItemPoints(itemTimeSec);
    weightedScore += points;
    updateWeightedScoreUI();
    updateWeightedBar(points / 10);
    hasAnsweredCurrentItem = true;

    showMessage(
      `Correct (${itemTimeSec.toFixed(1)} s, +${points.toFixed(1)} pts)`,
      'success'
    );
    // On surligne le monument CIBLE en vert
    highlightMonument(correctLayer, '#00aa00');
    feedbackCorrect();
  } else {
    errorsCount += 1;
    if (gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
      showMessage(
        `Incorrect (limite de ${MAX_ERRORS_MARATHON} erreurs atteinte)`,
        'error'
      );
    } else {
      showMessage('Incorrect', 'error');
    }
    // On surligne le monument CIBLE en rouge
    highlightMonument(correctLayer, '#d00');
    updateWeightedBar(0);
    feedbackError();
  }

  totalAnswered += 1;
  summaryData.push({
    name: answeredName,
    correct: isCorrect,
    time: itemTimeSec.toFixed(1)
  });

  // Analytics tracking (fire-and-forget)
  trackAnswer(answeredName, 'monuments', isCorrect, itemTimeSec);

  updateScoreUI();

  if (!isCorrect && gameMode === 'marathon' && errorsCount >= MAX_ERRORS_MARATHON) {
    endSession();
    return;
  }

  currentMonumentIndex += 1;
  setNewTarget();
}

function highlightMonument(layer, color) {
  if (!layer) return;

  layer.setStyle({ color: color, fillColor: color });

  setTimeout(() => {
    if (!layer.setStyle) return;
    layer.setStyle({ color: '#e3f2fd', fillColor: '#90caf9' });
  }, HIGHLIGHT_DURATION_MS);
}

// ------------------------
// Infos historiques rues principales
// ------------------------

function showStreetInfo(feature) {
  const panel = document.getElementById('street-info-panel');
  const infoEl = document.getElementById('street-info');
  if (!panel || !infoEl || !feature) return;

  const zoneMode = getZoneMode();

  // Si on n’est pas en mode "rues principales", on masque le panneau
  if (zoneMode !== 'rues-principales' && zoneMode !== 'main') {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
    return;
  }

  const rawName = feature.properties.name || '';
  const key = normalizeName(rawName);

  let info = MAIN_STREET_INFOS[key];

  if (!info && MAIN_STREET_NAMES.has(key)) {
    info = "Rue principale : informations historiques à compléter.";
  }

  if (!info) {
    panel.style.display = 'none';
    panel.classList.remove('is-visible');
    infoEl.textContent = '';
    infoEl.classList.remove('is-visible');
    return;
  }

  // Affichage + animation
  panel.style.display = 'block';
  infoEl.style.display = 'block';        // ← AJOUT ESSENTIEL

  // Reset animation du texte
  infoEl.classList.remove('is-visible');
  // force reflow pour relancer la transition
  void infoEl.offsetWidth;

  infoEl.innerHTML = `<strong>${rawName}</strong><br>${info}`;

  panel.classList.add('is-visible');
  infoEl.classList.add('is-visible');
}

// ------------------------
// Surbrillance de la rue cible
// ------------------------

// ── Analytics tracking (fire-and-forget) ──

function trackAnswer(streetName, mode, correct, timeSec) {
  if (!streetName) return;
  fetch(API_URL + '/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streetName, mode, correct, timeSec })
  }).catch(() => { }); // silent fail
}

// ── Feedback animations ──

function feedbackCorrect() {
  // Sound
  playDing();

  // Confetti burst
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 60,
      spread: 55,
      origin: { y: 0.7 },
      colors: ['#00aa00', '#22c55e', '#86efac', '#ffd500'],
      gravity: 1.2,
      scalar: 0.8,
      ticks: 120
    });
  }

  // Pulse glow on highlighted layers
  if (highlightedLayers && highlightedLayers.length > 0) {
    let pulseCount = 0;
    const pulseInterval = setInterval(() => {
      const w = pulseCount % 2 === 0 ? 12 : 6;
      const op = pulseCount % 2 === 0 ? 1 : 0.5;
      highlightedLayers.forEach(l => {
        if (l.setStyle) l.setStyle({ weight: w, opacity: op });
      });
      pulseCount++;
      if (pulseCount >= 6) {
        clearInterval(pulseInterval);
        highlightedLayers.forEach(l => {
          if (l.setStyle) l.setStyle({ weight: 8, opacity: 1 });
        });
      }
    }, 200);
  }
}

function feedbackError() {
  // Sound
  playBuzz();

  // Map container shake
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.classList.add('map-shake');
    setTimeout(() => mapEl.classList.remove('map-shake'), 500);
  }
}

function highlightStreet(color) {
  if (!currentTarget) return;
  const streetName = currentTarget.properties.name;
  highlightStreetByName(streetName, color);
}

function highlightStreetByName(streetName, color) {
  clearHighlight();
  const targetName = normalizeName(streetName);
  if (!targetName) return [];

  const layersToHighlight = [];
  streetLayersById.forEach(layer => {
    const name = normalizeName(layer.feature.properties.name);
    if (name === targetName) {
      layersToHighlight.push(layer);
    }
  });

  if (layersToHighlight.length === 0) return [];

  highlightedLayers = layersToHighlight;

  highlightedLayers.forEach(layer => {
    layer.setStyle({ color: color, weight: 8 });
  });

  let bounds = null;
  layersToHighlight.forEach(layer => {
    if (typeof layer.getBounds === 'function') {
      const b = layer.getBounds();
      if (!bounds) bounds = b;
      else bounds = bounds.extend(b);
    }
  });

  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 1.5 });
  }

  highlightTimeoutId = setTimeout(() => {
    highlightedLayers.forEach(layer => {
      layer.setStyle({ color: '#ffd500', weight: 5 });
    });
    highlightedLayers = [];
    highlightTimeoutId = null;
  }, HIGHLIGHT_DURATION_MS);

  return layersToHighlight;
}

function findMonumentLayerByName(name) {
  if (!monumentsLayer || !name) return null;

  const target = normalizeName(name);
  let foundLayer = null;

  monumentsLayer.eachLayer(layer => {
    const layerName = normalizeName(
      layer.feature?.properties?.name
    );
    if (layerName === target) {
      foundLayer = layer;
    }
  });

  return foundLayer;
}

function clearHighlight() {
  if (highlightTimeoutId !== null) {
    clearTimeout(highlightTimeoutId);
    highlightTimeoutId = null;
  }

  if (highlightedLayers && highlightedLayers.length > 0) {
    highlightedLayers.forEach(layer => {
      layer.setStyle({ color: '#ffd500', weight: 5 });
    });
    highlightedLayers = [];
  }
}

// ------------------------
// Focus depuis le récapitulatif (rues uniquement)
// ------------------------

function focusStreetByName(streetName) {
  const layers = highlightStreetByName(streetName, '#ffcc00');
  if (!layers || layers.length === 0) return;

  let bounds = null;
  layers.forEach(layer => {
    if (typeof layer.getBounds === 'function') {
      const b = layer.getBounds();
      if (!bounds) {
        bounds = b;
      } else {
        bounds = bounds.extend(b);
      }
    }
  });

  if (bounds && bounds.isValid && bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], animate: true, duration: 1.5 });
  }
}

// ------------------------
// Fin de session & récapitulatif
// ------------------------

function endSession() {
  playVictory();
  const now = performance.now();
  const totalTimeSec = sessionStartTime ? (now - sessionStartTime) / 1000 : 0;

  sessionStartTime = null;
  streetStartTime = null;
  currentTarget = null;
  currentMonumentTarget = null;
  isSessionRunning = false;
  isChronoMode = false;
  chronoEndTime = null;

  if (isDailyMode) {
    isDailyMode = false;
    updateDailyUI();
  }

  // Désactive explicitement le mode lecture
  isLectureMode = false;
  updateLayoutSessionState();

  isPaused = false;
  pauseStartTime = null;
  remainingChronoMs = null;

  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.style.display = 'none';

  const total = summaryData.length;
  const nbCorrect = summaryData.filter(r => r.correct).length;
  const percent = total === 0 ? 0 : Math.round((nbCorrect / total) * 100);

  const avgTime = total === 0
    ? 0
    : summaryData.reduce((acc, r) => acc + parseFloat(r.time), 0) / total;

  const gameMode = getGameMode();
  const zoneMode = getZoneMode();

  let quartierName = null;
  if (zoneMode === 'quartier') {
    const quartierSelect = document.getElementById('quartier-select');
    if (quartierSelect && quartierSelect.value) {
      quartierName = quartierSelect.value;
    }
  }

  const summaryEl = document.getElementById('summary');
  if (!summaryEl) return;

  // Celebration!
  if (percent === 100 && total > 0) {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  }

  // -------------------------------
  // STRUCTURE DU RÉCAP
  // -------------------------------
  summaryEl.innerHTML = '';

  // --- Bloc global ---
  const globalWrapper = document.createElement('div');
  globalWrapper.className = 'summary-global';

  const title = document.createElement('h2');
  title.textContent = 'Récapitulatif de la session';
  globalWrapper.appendChild(title);

  let modeText;
  if (gameMode === 'marathon') {
    modeText = `Mode : Marathon (max. ${MAX_ERRORS_MARATHON} erreurs)`;
  } else if (gameMode === 'chrono') {
    modeText = `Mode : Chrono (${CHRONO_DURATION} s)`;
  } else {
    modeText = `Mode : Classique (${SESSION_SIZE} items max)`;
  }

  modeText += ` – Zone : ${zoneMode}`;
  if (quartierName) {
    modeText += ` – Quartier : ${quartierName}`;
  }
  const modeInfo = document.createElement('p');
  modeInfo.textContent = modeText;
  globalWrapper.appendChild(modeInfo);

  const stats = document.createElement('div');
  stats.className = 'summary-stats';
  stats.innerHTML =
    `<p>Temps total : <strong>${totalTimeSec.toFixed(1)} s</strong></p>
     <p>Temps moyen par item : <strong>${avgTime.toFixed(1)} s</strong></p>
     <p>Score : <strong>${percent} %</strong> (${nbCorrect} bonnes réponses / ${total})</p>
     <p>Score pondéré : <strong>${weightedScore.toFixed(1)} pts</strong></p>`;
  globalWrapper.appendChild(stats);

  summaryEl.appendChild(globalWrapper);

  // --- Bloc détail + filtres ---
  const detailWrapper = document.createElement('div');
  detailWrapper.className = 'summary-detail';

  // En-tête liste
  const listHeader = document.createElement('div');
  listHeader.className = 'summary-detail-header';

  const listTitle = document.createElement('h3');
  listTitle.textContent = 'Détail par item (cliquable pour zoomer sur les rues)';
  listHeader.appendChild(listTitle);

  // Filtres
  const filterContainer = document.createElement('div');
  filterContainer.className = 'summary-filters';

  const filters = [
    { value: 'all', label: 'Tous' },
    { value: 'correct', label: 'Corrects' },
    { value: 'incorrect', label: 'Incorrects' }
  ];

  let activeFilter = 'all';

  filters.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'summary-filter-btn';
    btn.dataset.filter = f.value;
    btn.textContent = f.label;
    if (f.value === activeFilter) {
      btn.classList.add('is-active');
    }
    filterContainer.appendChild(btn);
  });

  listHeader.appendChild(filterContainer);
  detailWrapper.appendChild(listHeader);

  // Liste
  const list = document.createElement('ul');
  list.className = 'summary-list';

  summaryData.forEach(r => {
    const li = document.createElement('li');
    li.classList.add('summary-item');
    li.dataset.correct = r.correct ? 'true' : 'false';

    if (r.correct) {
      li.classList.add('summary-item--correct');
    } else {
      li.classList.add('summary-item--incorrect');
    }

    li.textContent = `${r.name} – ${r.correct ? 'Correct' : 'Incorrect'} – ${r.time} s`;
    li.dataset.streetName = r.name;

    li.addEventListener('click', () => {
      // Pour les rues, ça zoome ; pour les monuments, ça ne fera rien de spécial
      focusStreetByName(r.name);
    });

    list.appendChild(li);
  });

  detailWrapper.appendChild(list);
  summaryEl.appendChild(detailWrapper);

  // -------------------------------
  // LOGIQUE DE FILTRAGE
  // -------------------------------
  function applySummaryFilter(filter) {
    const items = list.querySelectorAll('.summary-item');
    items.forEach(li => {
      const isCorrect = li.dataset.correct === 'true';

      let visible = false;
      if (filter === 'all') {
        visible = true;
      } else if (filter === 'correct') {
        visible = isCorrect;
      } else if (filter === 'incorrect') {
        visible = !isCorrect;
      }

      li.style.display = visible ? '' : 'none';
    });
  }

  filterContainer.querySelectorAll('.summary-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newFilter = btn.dataset.filter;
      if (!newFilter || newFilter === activeFilter) return;

      activeFilter = newFilter;

      // état visuel
      filterContainer.querySelectorAll('.summary-filter-btn').forEach(b => {
        b.classList.toggle('is-active', b === btn);
      });

      // application du filtre
      applySummaryFilter(activeFilter);
    });
  });

  // Filtre initial
  applySummaryFilter(activeFilter);

  // Affiche le bloc récap
  summaryEl.classList.remove('hidden');

  showMessage('Session terminée.', 'info');
  const targetStreetEl = document.getElementById('target-street');
  if (targetStreetEl) {
    targetStreetEl.textContent = '—';
    requestAnimationFrame(fitTargetStreetText);
  }

  // Envoi du score au backend (si connecté)
  if (currentUser && currentUser.token) {
    sendScoreToServer({
      zoneMode,
      quartierName,
      gameMode,
      weightedScore,
      percentCorrect: percent,
      totalTimeSec,
      itemsAnswered: total,
      itemsCorrect: nbCorrect
    });
  }

  // Chargement du leaderboard pour ce mode
  loadLeaderboard(zoneMode, quartierName, gameMode);
}

// ------------------------
// Mise à jour de l'UI
// ------------------------

function updateScoreUI() {
  const scoreEl = document.getElementById('score');
  const pillEl = document.getElementById('score-pill');

  if (!scoreEl) return;

  if (totalAnswered === 0) {
    scoreEl.textContent = '0 / 0 (0 %)';
    if (pillEl) {
      pillEl.className = 'score-pill score-pill--neutral';
    }
    return;
  }

  const percent = Math.round((correctCount / totalAnswered) * 100);
  scoreEl.textContent = `${correctCount} / ${totalAnswered} (${percent} %)`;

  if (!pillEl) return;

  if (percent > 50) {
    pillEl.className = 'score-pill score-pill--good';
  } else if (percent > 0) {
    pillEl.className = 'score-pill score-pill--warn';
  } else {
    pillEl.className = 'score-pill score-pill--neutral';
  }
}

function updateTimeUI(totalTimeSec, streetTimeSec, chronoRemaining) {
  const totalEl = document.getElementById('total-time');
  const streetEl = document.getElementById('street-time');

  if (totalEl) {
    if (chronoRemaining !== null && chronoRemaining !== undefined) {
      // Chrono mode: show remaining time with color
      totalEl.textContent = chronoRemaining.toFixed(1) + ' s';
      if (chronoRemaining > 30) {
        totalEl.style.color = '#22c55e'; // green
        totalEl.classList.remove('chrono-blink');
      } else if (chronoRemaining > 10) {
        totalEl.style.color = '#f59e0b'; // orange
        totalEl.classList.remove('chrono-blink');
      } else {
        totalEl.style.color = '#ef4444'; // red
        if (chronoRemaining <= 5) {
          totalEl.classList.add('chrono-blink');
        }
      }
    } else {
      totalEl.textContent = totalTimeSec.toFixed(1) + ' s';
      totalEl.style.color = '';
      totalEl.classList.remove('chrono-blink');
    }
  }
  if (streetEl) {
    streetEl.textContent = streetTimeSec.toFixed(1) + ' s';
  }
}

function updateWeightedScoreUI() {
  const el = document.getElementById('weighted-score');
  if (!el) return;
  el.textContent = weightedScore.toFixed(1);
}

// ------------------------
// Barre de progression du score pondéré (par question)
// ------------------------

function updateWeightedBar(ratio) {
  const bar = document.getElementById('weighted-score-bar');
  if (!bar) return;

  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  bar.style.width = pct + '%';
}

function resetWeightedBar() {
  // 100 % de potentiel au début de chaque question
  updateWeightedBar(1);
}

// ------------------------
// Auth helpers
// ------------------------



function saveCurrentUserToStorage(user) {
  if (!user) return;
  try {
    window.localStorage.setItem('camino_user', JSON.stringify(user));
  } catch (e) {
    console.warn('Impossible de sauvegarder l’utilisateur.', e);
  }
}

function loadCurrentUserFromStorage() {
  const raw = window.localStorage.getItem('camino_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Erreur parsing user storage', e);
    return null;
  }
}

function clearCurrentUserFromStorage() {
  try {
    window.localStorage.removeItem('camino_user');
  } catch (e) {
    console.warn('Impossible de supprimer l’utilisateur stocké.', e);
  }
}

function updateUserUI() {
  const label = document.getElementById('current-user-label');
  const authBlock = document.querySelector('.auth-block');
  const logoutBtn = document.getElementById('logout-btn');
  const dailyBtn = document.getElementById('daily-mode-btn');
  const userSticker = document.getElementById('user-sticker');
  const loginHint = document.getElementById('login-hint');

  if (currentUser && currentUser.username) {
    if (label) label.textContent = `Connecté en tant que ${currentUser.username}`;
    if (userSticker) {
      userSticker.textContent = currentUser.username;
      userSticker.style.display = 'inline-block';
    }
    if (loginHint) loginHint.style.display = 'none';

    // Masquer les champs de connexion
    if (authBlock) {
      authBlock.querySelectorAll('input').forEach(i => i.style.display = 'none');
      const buttons = authBlock.querySelectorAll('button:not(#logout-btn)');
      buttons.forEach(b => b.style.display = 'none');
    }

    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (dailyBtn) dailyBtn.style.display = 'inline-block';

    // Show profile panel and load data
    const profilePanel = document.getElementById('profile-panel');
    if (profilePanel) profilePanel.style.display = 'block';
    loadProfile();
  } else {
    if (label) label.textContent = 'Non connecté.';
    if (userSticker) {
      userSticker.textContent = '';
      userSticker.style.display = 'none';
    }
    if (loginHint) loginHint.style.display = '';

    // Afficher les champs
    if (authBlock) {
      authBlock.querySelectorAll('input').forEach(i => i.style.display = '');
      const buttons = authBlock.querySelectorAll('button:not(#logout-btn)');
      buttons.forEach(b => b.style.display = '');
    }

    if (logoutBtn) logoutBtn.style.display = 'none';
    if (dailyBtn) dailyBtn.style.display = 'none';

    // Hide profile panel
    const profilePanel = document.getElementById('profile-panel');
    if (profilePanel) profilePanel.style.display = 'none';
  }
}

// ── Player Profile ──

// ── Badges / Succès ──

const BADGE_DEFINITIONS = [
  // Progression générale
  { id: 'first_game', emoji: '🎮', name: 'Première Partie', desc: 'Terminer une session', check: d => (parseInt(d.overall?.total_games) || 0) >= 1 },
  { id: 'games_10', emoji: '🔟', name: '10 Parties', desc: 'Jouer 10 sessions', check: d => (parseInt(d.overall?.total_games) || 0) >= 10 },
  { id: 'games_50', emoji: '💯', name: 'Habitué', desc: 'Jouer 50 sessions', check: d => (parseInt(d.overall?.total_games) || 0) >= 50 },
  { id: 'games_100', emoji: '💎', name: 'Vétéran', desc: 'Jouer 100 sessions', check: d => (parseInt(d.overall?.total_games) || 0) >= 100 },
  // Titres
  { id: 'minot', emoji: '🧒', name: 'Minot', desc: 'Atteindre le titre Minot', check: d => (parseFloat(d.overall?.best_score) || 0) >= 20 },
  { id: 'habitue', emoji: '⚓', name: 'Habitué du Vieux-Port', desc: 'Atteindre le titre Habitué', check: d => (parseFloat(d.overall?.best_score) || 0) >= 40 },
  { id: 'vrai', emoji: '💪', name: 'Vrai Marseillais', desc: 'Atteindre le titre Vrai Marseillais', check: d => (parseFloat(d.overall?.best_score) || 0) >= 60 },
  { id: 'maire', emoji: '🏛️', name: 'Maire de la Ville', desc: 'Atteindre le titre Maire', check: d => (parseFloat(d.overall?.best_score) || 0) >= 85 },
  // Zones
  { id: 'celebres', emoji: '⭐', name: 'Étoile de la Caneb', desc: 'Jouer en Rues Célèbres', check: d => (d.modes || []).some(m => m.mode === 'rues-celebres') },
  { id: 'ville', emoji: '🏙️', name: 'Explorateur', desc: 'Jouer en Ville Entière', check: d => (d.modes || []).some(m => m.mode === 'ville') },
  { id: 'monuments', emoji: '🗿', name: 'Touriste Culturel', desc: 'Jouer en mode Monuments', check: d => (d.modes || []).some(m => m.mode === 'monuments') },
  {
    id: 'all_zones', emoji: '🧭', name: 'Globe-trotter', desc: 'Jouer dans chaque zone', check: d => {
      const zones = new Set((d.modes || []).map(m => m.mode));
      return ['ville', 'quartier', 'rues-principales', 'rues-celebres', 'monuments'].every(z => zones.has(z));
    }
  },
  // Daily Challenge
  { id: 'daily_first', emoji: '📅', name: 'Premier Daily', desc: 'Réussir un Daily Challenge', check: d => (parseInt(d.daily?.successes) || 0) >= 1 },
  { id: 'daily_5', emoji: '🔥', name: 'Série de 5', desc: '5 Daily Challenges réussis', check: d => (parseInt(d.daily?.successes) || 0) >= 5 },
  { id: 'daily_10', emoji: '⚡', name: 'Série de 10', desc: '10 Daily Challenges réussis', check: d => (parseInt(d.daily?.successes) || 0) >= 10 },
  { id: 'daily_30', emoji: '🏆', name: 'Champion du Mois', desc: '30 Daily Challenges réussis', check: d => (parseInt(d.daily?.successes) || 0) >= 30 },
  // Performances
  { id: 'perfect', emoji: '🎯', name: 'Sans Faute', desc: 'Score de 100 dans une session', check: d => (parseFloat(d.overall?.best_score) || 0) >= 100 },
  {
    id: 'multi_mode', emoji: '🌟', name: 'Polyvalent', desc: 'Jouer dans 3 modes de jeu différents', check: d => {
      const types = new Set((d.modes || []).map(m => m.game_type));
      return types.size >= 3;
    }
  },
];

function computeBadges(profileData) {
  return BADGE_DEFINITIONS.map(badge => ({
    ...badge,
    unlocked: badge.check(profileData)
  }));
}

function loadProfile() {
  if (!currentUser || !currentUser.token) return;

  const el = document.getElementById('profile-content');
  if (!el) return;

  el.innerHTML = '<div class="skeleton skeleton-avatar"></div>' +
    '<div class="skeleton skeleton-line" style="width:60%"></div>' +
    '<div class="skeleton skeleton-block"></div>' +
    '<div class="skeleton skeleton-line" style="width:80%"></div>';

  fetch(API_URL + '/api/profile', {
    headers: { 'Authorization': 'Bearer ' + currentUser.token }
  })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      const bestScore = parseFloat(data.overall?.best_score) || 0;
      const bestMode = data.bestMode?.mode || null;
      const title = getPlayerTitle(bestScore, bestMode);
      const totalGames = parseInt(data.overall?.total_games) || 0;
      const avgScore = parseFloat(data.overall?.avg_score) || 0;
      const dailyTotal = parseInt(data.daily?.total_days) || 0;
      const dailySuccess = parseInt(data.daily?.successes) || 0;
      const dailyAvgAttempts = parseFloat(data.daily?.avg_attempts) || 0;
      const memberSince = data.memberSince
        ? new Date(data.memberSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        : '—';

      let html = `
        <div class="profile-header">
          <div class="profile-avatar">${(data.username || '?')[0].toUpperCase()}</div>
          <div class="profile-info">
            <div class="profile-name">${data.username}</div>
            <div class="profile-title">${title}</div>
          </div>
        </div>

        <div class="profile-stats-grid">
          <div class="profile-stat">
            <span class="profile-stat-value">${totalGames}</span>
            <span class="profile-stat-label">Parties</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${bestScore.toFixed(1)}</span>
            <span class="profile-stat-label">Meilleur</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${avgScore}</span>
            <span class="profile-stat-label">Moyenne</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value">${dailySuccess}/${dailyTotal}</span>
            <span class="profile-stat-label">Daily ✅</span>
          </div>
        </div>`;

      // Per-mode breakdown
      if (data.modes && data.modes.length > 0) {
        html += '<div class="profile-modes-title">Détail par mode</div>';
        html += '<div class="profile-modes">';
        data.modes.forEach(m => {
          const zoneLabel = ZONE_LABELS[m.mode] || m.mode;
          const gameLabel = GAME_LABELS[m.game_type] || m.game_type;
          const mTitle = getPlayerTitle(parseFloat(m.high_score) || 0, m.mode);
          html += `
            <div class="profile-mode-row">
              <div class="profile-mode-name">${zoneLabel} — ${gameLabel}</div>
              <div class="profile-mode-details">
                <span>🏆 ${parseFloat(m.high_score).toFixed(1)}</span>
                <span>📊 Ø${parseFloat(m.avg_score).toFixed(1)}</span>
                <span>🎮 ${m.games_played}</span>
              </div>
              <div class="profile-mode-title">${mTitle}</div>
            </div>`;
        });
        html += '</div>';
      }

      if (dailyTotal > 0) {
        html += `
          <div class="profile-daily-summary">
            <span>📅 Daily : ${dailyAvgAttempts} essais en moyenne</span>
          </div>`;
      }

      // Badges
      const badges = computeBadges(data);
      const unlocked = badges.filter(b => b.unlocked);
      const locked = badges.filter(b => !b.unlocked);

      html += `<div class="profile-badges-title">Succès (${unlocked.length}/${badges.length})</div>`;
      html += '<div class="profile-badges-grid">';
      unlocked.forEach(b => {
        html += `<div class="profile-badge unlocked" title="${b.name}: ${b.desc}">
          <span class="badge-emoji">${b.emoji}</span>
          <span class="badge-name">${b.name}</span>
        </div>`;
      });
      locked.forEach(b => {
        html += `<div class="profile-badge locked" title="${b.desc}">
          <span class="badge-emoji">🔒</span>
          <span class="badge-name">${b.name}</span>
        </div>`;
      });
      html += '</div>';

      html += `<div class="profile-member-since">Membre depuis le ${memberSince}</div>`;

      el.innerHTML = html;
    })
    .catch(err => {
      console.warn('Profile error:', err.message);
      el.innerHTML = '<p style="color:#94a3b8;font-size:12px;">Profil indisponible.</p>';
    });
}

// ------------------------
// API: envoi du score & leaderboard
// ------------------------

function sendScoreToServer(payload) {
  if (isDailyMode) return;
  if (!currentUser || !currentUser.token) return;

  try {
    fetch(API_URL + '/api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + currentUser.token
      },
      body: JSON.stringify({
        mode: payload.zoneMode,
        gameType: payload.gameMode,
        score: payload.weightedScore,
        itemsCorrect: payload.itemsCorrect,
        itemsTotal: payload.itemsAnswered,
        timeSec: payload.totalTimeSec
      })
    }).then(r => r.json()).then(() => {
      // Auto-refresh leaderboard after score submission
      loadAllLeaderboards();
    }).catch(err => {
      console.error('Erreur envoi score :', err);
    });
  } catch (err) {
    console.error('Erreur envoi score (synchrone) :', err);
  }
}

// --- Labels français ---
// ── Titre du joueur en fonction du score et du mode ──
const TITLE_THRESHOLDS = {
  'rues-celebres': [95, 70, 50, 30],
  'rues-principales': [90, 65, 45, 25],
  'quartier': [85, 60, 40, 20],
  'ville': [75, 50, 30, 10],
  'monuments': [85, 60, 40, 20]
};
const TITLE_NAMES = [
  '🏛️ Maire de la Ville',
  '💪 Vrai Marseillais',
  '⚓ Habitué du Vieux-Port',
  '🧒 Minot',
  '🧳 Touriste'
];
function getPlayerTitle(score, mode) {
  const t = TITLE_THRESHOLDS[mode] || TITLE_THRESHOLDS['quartier'];
  if (score >= t[0]) return TITLE_NAMES[0];
  if (score >= t[1]) return TITLE_NAMES[1];
  if (score >= t[2]) return TITLE_NAMES[2];
  if (score >= t[3]) return TITLE_NAMES[3];
  return TITLE_NAMES[4];
}

const ZONE_LABELS = {
  'ville': 'Ville entière',
  'rues-principales': 'Rues principales',
  'rues-celebres': 'Rues célèbres',
  'quartier': 'Quartier',
  'monuments': 'Monuments'
};
const GAME_LABELS = {
  'classique': 'Classique',
  'marathon': 'Marathon',
  'chrono': 'Chrono',
  'lecture': 'Lecture'
};

function loadAllLeaderboards() {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  el.innerHTML = '<div class="skeleton skeleton-line" style="width:50%"></div>' +
    '<div class="skeleton skeleton-block"></div>' +
    '<div class="skeleton skeleton-block"></div>';

  fetch(API_URL + '/api/leaderboards')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        el.innerHTML = '<p>Aucun score enregistré.</p>';
        return;
      }

      el.innerHTML = '';

      keys.forEach(key => {
        const [mode, gameType] = key.split('|');
        const rows = data[key];
        if (!rows || rows.length === 0) return;

        const section = document.createElement('div');
        section.className = 'leaderboard-section';

        const title = document.createElement('h4');
        title.className = 'leaderboard-section-title';
        const zoneLabel = ZONE_LABELS[mode] || mode;
        const gameLabel = GAME_LABELS[gameType] || gameType;
        title.textContent = `${zoneLabel} — ${gameLabel}`;
        section.appendChild(title);

        const table = document.createElement('table');
        table.className = 'leaderboard-table';

        // Column headers adapt per game type
        const thead = document.createElement('thead');
        let headerHTML = '<tr><th>#</th><th>Joueur</th><th>Score</th>';
        if (gameType === 'marathon') {
          headerHTML += '<th>Trouvés</th>';
        }
        if (gameType === 'chrono') {
          headerHTML += '<th>Temps</th>';
        }
        headerHTML += '<th>Parties</th></tr>';
        thead.innerHTML = headerHTML;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach((r, i) => {
          const tr = document.createElement('tr');
          const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '';
          const rank = medal || `${i + 1}`;
          const title = getPlayerTitle(r.high_score || 0, mode);
          let html = `<td>${rank}</td><td>${r.username || 'Anonyme'}<br><small style="color:#94a3b8;font-size:10px">${title}</small></td>`;
          html += `<td>${typeof r.high_score === 'number' ? r.high_score.toFixed(1) : '-'}</td>`;

          if (gameType === 'marathon') {
            const found = r.items_correct || 0;
            const total = r.items_total || 0;
            html += `<td>${found}/${total}</td>`;
          }
          if (gameType === 'chrono') {
            const t = r.time_sec || 0;
            html += `<td>${t.toFixed(1)}s</td>`;
          }

          html += `<td>${r.games_played || 0}</td>`;
          tr.innerHTML = html;
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        section.appendChild(table);
        el.appendChild(section);
      });
    })
    .catch(err => {
      console.warn('Leaderboard indisponible :', err.message);
      el.innerHTML = '<p>Aucun score enregistré.</p>';
    });
}

function loadLeaderboard(zoneMode, quartierName, gameMode) {
  // Redirect to full leaderboard load
  loadAllLeaderboards();
}



// ------------------------
// Daily Challenge Logic
// ------------------------

async function handleDailyModeClick() {
  if (!currentUser || !currentUser.token) {
    showMessage('Connectez-vous pour accéder au défi quotidien.', 'warning');
    return;
  }

  try {
    const res = await fetch(API_URL + '/api/daily', {
      headers: { 'Authorization': `Bearer ${currentUser.token}` }
    });
    if (!res.ok) throw new Error('Erreur chargement défi');

    const data = await res.json();
    startDailySession(data);
  } catch (err) {
    console.error(err);
    showMessage('Impossible de charger le défi quotidien.', 'error');
  }
}

let dailyTargetData = null;
let dailyTargetGeoJson = null;
let isDailyMode = false;
let dailyHighlightLayer = null;
let dailyGuessHistory = [];

function startDailySession(data) {
  dailyTargetData = data;
  dailyTargetGeoJson = JSON.parse(data.targetGeoJson); // [lon, lat]

  const status = data.userStatus || {};

  let isAlreadyFinished = false;
  let finalResultObj = null;

  if (status.success) {
    isAlreadyFinished = true;
    finalResultObj = { success: true, attempts: status.attempts_count };
  } else if (status.attempts_count >= 7) {
    isAlreadyFinished = true;
    finalResultObj = { success: false, attempts: status.attempts_count };
  }

  // Start daily session context
  isDailyMode = true;

  // Restore guess history from localStorage if resuming
  dailyGuessHistory = [];
  window._dailyGameOver = false;
  window._dailyGuessInFlight = false;
  const historyEl = document.getElementById('daily-guesses-history');
  if (historyEl) { historyEl.style.display = 'none'; historyEl.innerHTML = ''; }

  if (isAlreadyFinished) {
    restoreDailyGuessesFromStorage(data.date);
  } else if ((status.attempts_count || 0) > 0 && !status.success) {
    restoreDailyGuessesFromStorage(data.date);
    if (dailyGuessHistory.length > 0) {
      renderDailyGuessHistory();
    }
  }

  // Clean up old days from localStorage
  cleanOldDailyGuessStorage(data.date);

  // Cleanup any existing session
  if (isSessionRunning) endSession();
  removeDailyHighlight();

  // Force zone to "ville"
  currentZoneMode = 'ville';
  const modeSelect = document.getElementById('mode-select');
  const modeBtn = document.getElementById('mode-select-button');
  if (modeSelect) {
    modeSelect.value = 'ville';
    if (modeBtn) {
      modeBtn.innerHTML = '<span class="custom-select-label">Ville entière</span><span class="difficulty-pill difficulty-pill--hard">Difficile</span>';
    }
  }

  // Set target name
  const targetEl = document.getElementById('target-street');
  if (targetEl) {
    targetEl.textContent = data.streetName;
    requestAnimationFrame(fitTargetStreetText);
  }

  // Update target panel title with attempts
  const remaining = Math.max(0, 7 - (status.attempts_count || 0));
  const titleEl = document.getElementById('target-panel-title');
  if (titleEl) {
    if (isAlreadyFinished) {
      titleEl.textContent = status.success ? '🎉 Défi réussi !' : '❌ Défi échoué';
    } else {
      titleEl.textContent = `🎯 Défi quotidien — ${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`;
    }
  }

  // Start game state
  isSessionRunning = true;
  updateLayoutSessionState();

  // Hide skip and pause buttons (no skip/pause in daily)
  const skipBtn = document.getElementById('skip-btn');
  const pauseBtn = document.getElementById('pause-btn');
  if (skipBtn) skipBtn.style.display = 'none';
  if (pauseBtn) pauseBtn.style.display = 'none';

  // Show stop button as "Quitter le défi"
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.textContent = 'Quitter le défi';
    restartBtn.classList.remove('btn-primary');
    restartBtn.classList.add('btn-stop');
    restartBtn.style.display = '';
  }

  // Force map refresh for all streets
  if (modeSelect) {
    modeSelect.dispatchEvent(new Event('change'));
  }

  // If already finished, display history and geometry immediately
  if (isAlreadyFinished) {
    if (dailyGuessHistory.length > 0) {
      renderDailyGuessHistory(finalResultObj);
    }
    if (data.targetGeometry) {
      highlightDailyTarget(data.targetGeometry, status.success);
    }
    if (status.success) {
      showMessage(`🎉 Déjà réussi aujourd'hui en ${status.attempts_count} essai${status.attempts_count > 1 ? 's' : ''} !`, 'success');
    } else {
      showMessage(`❌ Plus d'essais pour aujourd'hui. La rue était « ${data.streetName} ».`, 'error');
    }
  } else {
    showMessage(`Trouvez : ${data.streetName} (${remaining} essais restants)`, 'info');
  }

  updateDailyUI();
}

function endDailySession() {
  isDailyMode = false;
  isSessionRunning = false;
  window._dailyGameOver = false;
  window._dailyGuessInFlight = false;

  // Restore target panel title
  const titleEl = document.getElementById('target-panel-title');
  if (titleEl) titleEl.textContent = 'Rue à trouver';

  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();
  updateDailyUI();
}

function renderDailyGuessHistory(finalResult) {
  try {
    const container = document.getElementById('daily-guesses-history');
    if (!container) return;

    // If success with no previous wrong guesses and no history, just show result
    if (dailyGuessHistory.length === 0 && (!finalResult || !finalResult.success)) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'block';

    let html = '';

    // Show guess table only if there are wrong attempts
    if (dailyGuessHistory.length > 0) {
      html += '<div class="daily-history-title">Essais précédents</div>';
      html += '<table class="daily-history-table">';
      html += '<thead><tr><th>#</th><th>Rue tentée</th><th>Distance</th><th></th></tr></thead>';
      html += '<tbody>';

      dailyGuessHistory.forEach((g, i) => {
        const distStr = g.distance >= 1000
          ? `${(g.distance / 1000).toFixed(1)} km`
          : `${Math.round(g.distance)} m`;
        const isLast = (i === dailyGuessHistory.length - 1) && !finalResult;
        // Color-coded distance class
        let distClass = 'dist-cold';
        if (g.distance < 500) distClass = 'dist-hot';
        else if (g.distance < 2000) distClass = 'dist-warm';
        html += `<tr class="${isLast ? 'daily-row-enter' : ''}">`;
        html += `<td>${i + 1}</td>`;
        html += `<td>${g.streetName}</td>`;
        html += `<td class="${distClass}">${distStr}</td>`;
        html += `<td class="daily-arrow">${g.arrow || ''}</td>`;
        html += '</tr>';
      });

      html += '</tbody></table>';
    }

    // Progressive hints
    const attemptsCount = dailyGuessHistory.length;
    if (attemptsCount >= 2 && dailyTargetData && !finalResult) {
      html += '<div class="daily-hints">';
      html += '<div class="daily-hints-title">💡 Indices</div>';

      // Hint 1 (after 2 attempts): Arrondissement
      const quartierRaw = dailyTargetData.quartier || '';
      try {
        const normQ = normalizeQuartierKey(quartierRaw);
        if (arrondissementByQuartier && arrondissementByQuartier.has(normQ)) {
          const arr = arrondissementByQuartier.get(normQ);
          if (arr) {
            html += `<div class="daily-hint">📍 Arrondissement : <strong>${arr}</strong></div>`;
          }
        }
      } catch (e) { console.error('Error with Hint 1:', e); }

      // Hint 2 (after 4 attempts): Quartier
      if (attemptsCount >= 4 && quartierRaw) {
        html += `<div class="daily-hint">🏘️ Quartier : <strong>${quartierRaw}</strong></div>`;
      }

      // Hint 3 (after 6 attempts): Street length
      if (attemptsCount >= 6 && dailyTargetData.streetName) {
        try {
          const len = calculateStreetLength(dailyTargetData.streetName);
          if (len > 0) {
            const lenStr = len >= 1000 ? `${(len / 1000).toFixed(1)} km` : `${Math.round(len)} m`;
            html += `<div class="daily-hint">📏 Longueur : <strong>~ ${lenStr}</strong></div>`;
          }
        } catch (e) { console.error('Error with Hint 3:', e); }
      }

      html += '</div>';
    }

    // Final result footer
    if (finalResult) {
      if (finalResult.success) {
        const n = finalResult.attempts;
        html += `<div class="daily-result daily-result--success">🎉 Bravo, vous avez trouvé la rue en ${n} essai${n > 1 ? 's' : ''} !</div>`;
      } else {
        const bestDist = Math.min(...dailyGuessHistory.map(g => g.distance));
        const bestStr = bestDist >= 1000
          ? `${(bestDist / 1000).toFixed(1)} km`
          : `${Math.round(bestDist)} m`;
        html += `<div class="daily-result daily-result--fail">Votre meilleur score est ${bestStr} en sept essais</div>`;
      }

      // Share buttons
      html += `<div class="daily-share-buttons">`;
      html += `<button id="daily-share-text" class="btn-secondary daily-share-btn">📋 Copier le texte</button>`;
      html += `<button id="daily-share-image" class="btn-primary daily-share-btn">📸 Partager l'image</button>`;
      html += `</div>`;
      html += `<p class="daily-share-hint">L'image est plus impactante sur les réseaux !</p>`;
    }

    container.innerHTML = html;

    // Add share listeners
    if (finalResult) {
      const shareTextBtn = document.getElementById('daily-share-text');
      const shareImageBtn = document.getElementById('daily-share-image');
      if (shareTextBtn) {
        shareTextBtn.addEventListener('click', () => handleDailyShareText(finalResult));
      }
      if (shareImageBtn) {
        shareImageBtn.addEventListener('click', () => handleDailyShareImage(finalResult));
      }
    }

  } catch (err) {
    console.error("Error in renderDailyGuessHistory:", err);
  }
}

function handleDailyShareText(finalResult) {
  if (!dailyTargetData) return;
  const attempts = finalResult.success ? finalResult.attempts : 'X';
  let text = `Camino - ${dailyTargetData.streetName} 📍🎯 ${attempts}/7\n\n`;

  dailyGuessHistory.forEach((g, i) => {
    if (finalResult.success && i === dailyGuessHistory.length - 1) {
      text += `🟩 🏁\n`;
    } else {
      let square = '🟥';
      if (g.distance < 500) square = '🟩';
      else if (g.distance < 2000) square = '🟨';
      text += `${square} ${g.arrow || ''}\n`;
    }
  });

  text += `\nmarseille-camino6.netlify.app`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showMessage('Texte copié !', 'success');
    }).catch(() => showMessage('Erreur lors de la copie', 'error'));
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showMessage('Texte copié !', 'success');
    } catch (e) {
      showMessage('Impossible de copier', 'error');
    }
  }
}

function handleDailyShareImage(finalResult) {
  if (!dailyTargetData) return;

  const canvas = document.createElement('canvas');
  const W = 600, H = 480;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f172a');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle border
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
  ctx.lineWidth = 2;
  ctx.roundRect(4, 4, W - 8, H - 8, 16);
  ctx.stroke();

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🗺️ CAMINO', W / 2, 50);

  // Date
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(`Défi du ${today}`, W / 2, 75);

  // Street name
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(dailyTargetData.streetName, W / 2, 110);

  // Result: success or fail
  const attempts = finalResult.success ? finalResult.attempts : 'X';
  ctx.fillStyle = finalResult.success ? '#22c55e' : '#ef4444';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText(`${attempts}/7`, W / 2, 160);

  // Guess grid
  const gridTop = 185;
  const rowH = 34;
  const squareSize = 28;
  const startX = 160;

  dailyGuessHistory.forEach((g, i) => {
    const y = gridTop + i * rowH;
    const isLast = finalResult.success && i === dailyGuessHistory.length - 1;

    // Colored square
    let color = '#ef4444'; // red
    if (isLast) color = '#22c55e';
    else if (g.distance < 500) color = '#22c55e';
    else if (g.distance < 2000) color = '#eab308';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(startX, y, squareSize, squareSize, 4);
    ctx.fill();

    // Arrow or flag
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(isLast ? '🏁' : (g.arrow || ''), startX + 38, y + 22);

    // Distance
    if (!isLast) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px system-ui, sans-serif';
      const distStr = g.distance >= 1000
        ? `${(g.distance / 1000).toFixed(1)} km`
        : `${Math.round(g.distance)} m`;
      ctx.fillText(distStr, startX + 80, y + 22);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('Trouvé !', startX + 80, y + 22);
    }

    // Attempt number
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`#${i + 1}`, startX - 10, y + 20);
  });

  // Footer URL
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6366f1';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText('marseille-camino6.netlify.app', W / 2, H - 20);

  // Convert to blob and share/download
  canvas.toBlob(async (blob) => {
    if (!blob) {
      showMessage('Erreur lors de la génération', 'error');
      return;
    }

    const file = new File([blob], 'camino-daily.png', { type: 'image/png' });

    // Try Web Share API first (mobile + modern browsers)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: 'Camino - Défi Quotidien',
          text: `J'ai trouvé la rue en ${attempts}/7 !`,
          files: [file]
        });
        showMessage('Partagé !', 'success');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user cancelled
      }
    }

    // Fallback: copy image to clipboard
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showMessage('Image copiée dans le presse-papier !', 'success');
        return;
      } catch (e) { /* fallback to download */ }
    }

    // Fallback: download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'camino-daily.png';
    a.click();
    URL.revokeObjectURL(url);
    showMessage('Image téléchargée !', 'success');
  }, 'image/png');
}

// Direction arrow: returns emoji arrow from clicked toward target
function getDirectionArrow(clickedCoords, targetCoords) {
  // coords are [lon, lat]
  const dLon = targetCoords[0] - clickedCoords[0];
  const dLat = targetCoords[1] - clickedCoords[1];
  const angle = Math.atan2(dLon, dLat) * 180 / Math.PI; // 0=North, 90=East
  // Normalize to 0-360
  const a = ((angle % 360) + 360) % 360;
  const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
  const idx = Math.round(a / 45) % 8;
  return arrows[idx];
}

// localStorage helpers for daily guess persistence
function saveDailyGuessesToStorage() {
  if (!dailyTargetData || !dailyTargetData.date) return;
  try {
    const key = `camino_daily_guesses_${dailyTargetData.date}`;
    localStorage.setItem(key, JSON.stringify(dailyGuessHistory));
  } catch (e) { /* quota exceeded or private browsing */ }
}

function restoreDailyGuessesFromStorage(date) {
  try {
    const key = `camino_daily_guesses_${date}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      dailyGuessHistory = JSON.parse(raw);
    }
  } catch (e) { dailyGuessHistory = []; }
}

function cleanOldDailyGuessStorage(currentDate) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('camino_daily_guesses_') && !key.endsWith(currentDate)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) { /* ignore */ }
}

function highlightDailyTarget(geometryJson, isSuccess) {
  removeDailyHighlight();

  if (!geometryJson || !map) return;

  let geometry;
  try {
    geometry = typeof geometryJson === 'string' ? JSON.parse(geometryJson) : geometryJson;
  } catch (e) {
    console.error('Invalid target geometry:', e);
    return;
  }

  const color = isSuccess ? '#4caf50' : '#f44336';

  dailyHighlightLayer = L.geoJSON(
    { type: 'Feature', geometry, properties: {} },
    {
      style: {
        color: color,
        weight: 6,
        opacity: 1,
        dashArray: isSuccess ? null : '8, 4'
      }
    }
  ).addTo(map);

  // Zoom to the target if valid bounds exist
  try {
    if (dailyHighlightLayer && Object.keys(dailyHighlightLayer._layers).length > 0) {
      const bounds = dailyHighlightLayer.getBounds();
      if (bounds && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16, animate: true, duration: 1.5 });
      }
    }
  } catch (err) {
    console.error("Could not fit logic bounds", err);
  }
}

function removeDailyHighlight() {
  if (dailyHighlightLayer && map) {
    map.removeLayer(dailyHighlightLayer);
    dailyHighlightLayer = null;
  }
}

// Haversine distance in meters
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function pointToSegmentDistance(lat, lon, lon1, lat1, lon2, lat2) {
  const R = 6371e3;
  const cosLat = Math.cos(lat * Math.PI / 180);

  const x = lon * cosLat * R * Math.PI / 180;
  const y = lat * R * Math.PI / 180;
  const x1_m = lon1 * cosLat * R * Math.PI / 180;
  const y1_m = lat1 * R * Math.PI / 180;
  const x2_m = lon2 * cosLat * R * Math.PI / 180;
  const y2_m = lat2 * R * Math.PI / 180;

  const dx = x2_m - x1_m;
  const dy = y2_m - y1_m;
  const vx = x - x1_m;
  const vy = y - y1_m;

  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq !== 0) {
    t = Math.max(0, Math.min(1, (vx * dx + vy * dy) / lenSq));
  }

  const projX = x1_m + t * dx;
  const projY = y1_m + t * dy;

  const distSq = (x - projX) * (x - projX) + (y - projY) * (y - projY);
  return Math.sqrt(distSq);
}

function getDistanceToFeature(lat, lon, geo) {
  if (!geo) return 0;
  let minDistance = Infinity;

  function processLineString(coords) {
    for (let i = 0; i < coords.length - 1; i++) {
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      const dist = pointToSegmentDistance(lat, lon, lon1, lat1, lon2, lat2);
      if (dist < minDistance) minDistance = dist;
    }
  }

  if (geo.type === 'LineString') {
    processLineString(geo.coordinates);
  } else if (geo.type === 'MultiLineString') {
    geo.coordinates.forEach(processLineString);
  } else if (geo.type === 'Point') {
    minDistance = getDistanceMeters(lat, lon, geo.coordinates[1], geo.coordinates[0]);
  }

  return minDistance !== Infinity ? minDistance : 0;
}

function calculateStreetLength(streetName) {
  try {
    if (!streetName || !allStreetFeatures) return 0;
    const nameNorm = normalizeName(streetName);
    const feature = allStreetFeatures.find(f => f && f.properties && f.properties.name && normalizeName(f.properties.name) === nameNorm);
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return 0;

    let totalLength = 0;
    const geo = feature.geometry;

    if (geo.type === 'LineString') {
      for (let i = 0; i < geo.coordinates.length - 1; i++) {
        const [lon1, lat1] = geo.coordinates[i];
        const [lon2, lat2] = geo.coordinates[i + 1];
        totalLength += getDistanceMeters(lat1, lon1, lat2, lon2);
      }
    } else if (geo.type === 'MultiLineString') {
      for (const line of geo.coordinates) {
        for (let i = 0; i < line.length - 1; i++) {
          const [lon1, lat1] = line[i];
          const [lon2, lat2] = line[i + 1];
          totalLength += getDistanceMeters(lat1, lon1, lat2, lon2);
        }
      }
    }
    return totalLength;
  } catch (e) {
    console.error("Error calculating street length:", e);
    return 0;
  }
}

function computeFeatureCentroid(feature) {
  const geo = feature.geometry;
  let coords = [];
  if (geo.type === 'LineString') {
    coords = geo.coordinates;
  } else if (geo.type === 'MultiLineString') {
    coords = geo.coordinates.flat();
  } else if (geo.type === 'Point') {
    return geo.coordinates;
  } else {
    return [5.3698, 43.2965]; // Fallback
  }
  if (coords.length === 0) return [5.3698, 43.2965];
  const sum = coords.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
  return [sum[0] / coords.length, sum[1] / coords.length];
}

function updateDailyUI() {
  const status = dailyTargetData ? dailyTargetData.userStatus : {};
  // Utiliser le max entre le compteur local et celui du serveur
  const attempts = Math.max(dailyGuessHistory.length, status.attempts_count || 0);
  const remaining = 7 - attempts;

  if (isDailyMode) {
    setMapStatus(`Défi: ${remaining} essais`, 'ready');

    // Update title with remaining attempts
    const titleEl = document.getElementById('target-panel-title');
    if (titleEl) {
      if (status.success) {
        titleEl.textContent = '🎉 Défi réussi !';
      } else if (remaining <= 0) {
        titleEl.textContent = '❌ Défi échoué';
      } else {
        titleEl.textContent = `🎯 Défi quotidien — ${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`;
      }
    }
  }

  const counter = document.getElementById('daily-tries-counter');
  if (counter) {
    if (isDailyMode) {
      counter.style.display = 'flex';
      counter.innerHTML = `<span>🎯</span> ${attempts} / 7 essais`;
    } else {
      counter.style.display = 'none';
    }
  }
}

// Inject daily mode into the "Quitter le défi" button
function handleDailyStop() {
  if (isDailyMode) {
    endDailySession();
    removeDailyHighlight();
    return true; // Handled
  }
  return false;
}


function fitTargetStreetText() {
  const el = document.getElementById("target-street");
  if (!el) return;

  // Mobile uniquement
  if (!window.matchMedia("(max-width: 600px)").matches) {
    el.style.fontSize = ""; // reset desktop/tablette
    return;
  }

  // Mesure fiable : on force le nowrap (au cas où)
  el.style.whiteSpace = "nowrap";

  // Largeur disponible (padding inclus dans le parent, mais el est block)
  const maxWidth = el.clientWidth;
  if (maxWidth <= 0) return;

  // Bornes de taille (à ajuster si tu veux)
  const MAX = 18;  // taille "normale" mobile
  const MIN = 11;  // taille mini lisible

  // Reset à la taille max avant calcul
  el.style.fontSize = MAX + "px";

  // Si ça tient déjà, fini
  if (el.scrollWidth <= maxWidth) return;

  // Recherche binaire pour trouver la plus grande taille qui tient
  let lo = MIN, hi = MAX, best = MIN;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    el.style.fontSize = mid + "px";

    if (el.scrollWidth <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  el.style.fontSize = best + "px";
}

// Refit sur resize / rotation
window.addEventListener("resize", () => {
  // RAF = attend que le layout soit stable
  requestAnimationFrame(fitTargetStreetText);
});
window.addEventListener("orientationchange", () => {
  requestAnimationFrame(fitTargetStreetText);
});

// ── Service Worker registration ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}
