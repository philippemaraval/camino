// ------------------------
// Paramètres du jeu
// ------------------------

const SESSION_SIZE = 20;           // 20 rues / monuments par session
const MAX_ERRORS_MARATHON = 3;     // 3 erreurs max en mode "marathon"
const MAX_TIME_SECONDS = 500;      // coupe les chronos à 500 s (sécurité)
const CHRONO_DURATION = 60;        // mode chrono : 60 secondes
const HIGHLIGHT_DURATION_MS = 5000 // 5 secondes
const MAX_POINTS_PER_ITEM = 10;

// Rues principales de Marseille (en minuscules)
const MAIN_STREET_NAMES = new Set([
  'rue de la république',
  'la canebière',
  'avenue robert schuman',
  'quai des belges',
  'quai de rive-neuve',
  'boulevard des dames',
  'cours julien',
  'cours lieutaud',
  'cours jean ballard',
  'rue breteuil',
  'rue sainte',
  'rue saint-ferréol',
  'rue paradis',
  'rue de rome',
  'cours pierre puget',
  'place jean jaurès',
  'place castellane',
  'avenue du prado',
  'rond-point du prado',
  'boulevard michelet',
  'boulevard rabatau',
  'avenue jules cantini',
  'boulevard baille',
  'boulevard chave',
  'allée léon gambetta',
  'boulevard jean moulin',
  'boulevard sakakini',
  'boulevard françoise duparc',
  'boulevard national',
  'boulevard de plombières',
  'avenue alexandre fleming',
  'boulevard du maréchal juin',
  'corniche du président john fitzgerald kennedy',
  'boulevard de la corderie',
  'avenue de la corse',
  'boulevard charles livon',
  'rue des catalans',
  'place aux huiles',
  'rue saint-pierre',
  'boulevard schloesing',
  'boulevard romain rolland',
  'boulevard de sainte-marguerite',
  'avenue de mazargues',
  'promenade georges pompidou',
  'avenue pierre mendès france',
  'cours belsunce',
  'cours saint-louis',
  'place jules guesde',
  'place des marseillaises',
  'boulevard camille flammarion',
  'avenue des chutes lavie',
  'boulevard périer',
  'rue d\'endoume',
  'place du 4 septembre',
  'place de la corderie henri bergasse',
  'boulevard notre-dame',
  'boulevard vauban',
  'rue du bois sacré',
  'boulevard de paris',
  'boulevard de strasbourg',
  'place de lenche',
  'place de la major',
  'rue colbert',
  'rue grignan',
  'rue d\'aubagne',
  'boulevard garibaldi',
  'rue de lodi',
  'rue du rouet',
  'avenue du maréchal foch',
  'avenue des chartreux',
  'boulevard de la blancarde',
  'place sébastopol',
  'cours joseph thierry',
  'place notre-dame-du-mont',
  'place félix baret',
  'avenue du cap pinède',
  'avenue roger salengro',
  'boulevard du capitaine gèze',
  'avenue des aygalades',
  'avenue de toulon',
  'boulevard bompard',
  'avenue de hambourg',
  'boulevard charles moretti',
  'avenue viton',
  'boulevard de la gaye',
  'rue de lyon',
  'boulevard jeanne d\’arc',
  'avenue de la capelette',
  'boulevard fifi turin',
  'boulevard voltaire',
  'avenue de montolivet',
  'avenue de saint-just',
  'avenue jean-paul sartre',
  'boulevard guigou',
  'boulevard de montricher',
  'avenue de la fourragère',
  'avenue camille pelletan',
  'rue émile zola',
  'boulevard ferdinand de lesseps',
  'avenue arnavon',
  'l2 nord',
  'l2 est',
  'boulevard de la maison blanche',
  'avenue de saint-louis',
  'avenue de la viste',
  'avenue de saint-antoine',
  'rue félix pyat',
  'boulevard danielle casanova',
  'boulevard gay lussac',
  'avenue ibrahim ali',
  'boulevard burel',
  'boulevard philippon',
  'cours franklin roosevelt',
  'square stalingrad',
  'boulevard longchamp',
  'avenue de saint-barnabé',      
  'avenue de saint-julien',
  'avenue du 24 avril 1915',
  'rue pierre de béranger',
  'avenue fernandel',
  'avenue des trois lucs',
  'boulevard mireille lauze',
  'chemin de l\'armée d\'afrique',
  'avenue de la timone',
  'boulevard de pont de vivaux',
  'boulevard gaston crémieux',
  'avenue pasteur',
  'boulevard de dunkerque',
  'quai du port',
  'rue d\'aix',
  'avenue général leclerc',
  'chemin saint-jean-du-désert',
  'boulevard dugommier',
  'boulevard d\'athènes',
  'chemin du littoral',
  'avenue de la madrague de montredon',
  'avenue de la croix rouge',
  'avenue de la rose',
  'avenue des olives',
  'avenue des poilus',
  'rue montaigne',
  'place caire',
  'rue alphonse daudet',
  'avenue de valdonne',
  'avenue de saint-jérôme',
  'chemin de château-gombert',
  'boulevard de saint-loup',
  'boulevard de la valbarelle',
  'boulevard de saint-marcel',
  'boulevard de la barasse',
  'boulevard de la millière',
  'avenue de saint-menet',
  'boulevard de la pomme',
  'avenue jean lombard',
  'avenue des peintres roux',
  'route des camoins',
  'route d\'allauch',
  'boulevard du redon',
  'route léon lachamp',
  'route de la gineste',
  'boulevard de la concorde',
  'chemin du roucas-blanc',
  'boulevard georges estrangin',
  'boulevard paul peytral',
  'boulevard louis salvator',
  'rue des trois frères barthélémy',
  'place estrangin pastré',
  'place de la joliette',
  'boulevard eugène pierre',
  'rue du camas',
  'rue loubon',
  'place bernard cadenat',
  'chemin de sainte-marthe',
  'avenue escadrille normandie-niémen',
  'avenue du merlan',
  'chemin de saint-joseph à sainte-marthe',
  'boulevard henri barnier',
  'avenue andré roussin',
  'rue condorcet',
  'rue rabelais',
  'boulevard fenouil',
  'plage de l\'estaque',
  'chemin du ruisseau mirabeau',
  'boulevard des bassins de radoub',
  'rue saint-cassien',
  'boulevard des libérateurs',
  'boulevard rabatau daniel matalon',
  'boulevard paul claudel',
  'avenue de la panouse',
  'avenue de luminy',
  'boulevard mireille jourdan-barry',
  'place de la gare de la blancarde',
  'route de la treille',
  'chemin du vallon de l\'oriol',
  'rue le chatelier',
  'avenue william booth',
  'avenue des butris',
  'traverse des butris',
  'allées turcat méry',
  'chemin du vallon vert',
  'avenue des caillols',
  'boulevard de la libération - général de monsabert',
  'rue raymond teisseire',
  'boulevard du cabot',
  'avenue de lattre de tassigny',
  'rond-point de mazargues et de la légion d\'honneur',
  'chemin de sormiou',
  'chemin de morgiou',
  'avenue alexandre dumas',
  'boulevard du sablier',
  'avenue de bonneveine',
  'avenue de montredon',
  'chemin des goudes',
  'avenue de la pointe rouge',
  'boulevard jacques saadé quai de la tourette',
  'boulevard jacques saadé quai de la joliette',
  'boulevard jacques saadé quai du lazaret',
  'boulevard jacques saadé quai d\'arenc',
  'rue de la belle de mai',
  'place du général de gaulle',
  'boulevard de la liberté',
  'place leverrier',
  'boulevard louis villecroze',
  'avenue claude monet',
  'avenue prosper mérimée',
  'avenue de la marche pour l’égalité et contre le racisme',
  'chemin du merlan à la rose',
  'boulevard anatole de la forge',
  'rond-point pierre paraf',
  'rue berthelot',
  'boulevard bazile barrelier',
  'boulevard roland dorgelès',
  'place bougainville',
  'chemin de la madrague ville',
  'chemin de saint-louis au rove',
  'chemin de saint-antoine à saint-joseph',
  'route du rove',
  'boulevard du bosphore',
  'chemin du lancier',
  'boulevard catherine blum',
  'boulevard elie wiesel',
  'boulevard alexandre delabre',
  'boulevard pierre dramard',
  'boulevard charles nédelec',
  'boulevard mirabeau',
  'avenue de château-gombert',
  'place félix barret',
  'rue augustin aubert',
  'chemin du roy d\'espagne',
  'avenue clot-bey',
  'avenue andré zénatti',
  'traverse parangon',
  'rue aviateur le brix',
  'rue saint-jean du désert',
  'boulevard gassendi',
  'boulevard de la cartonnerie',
  'route de la valentine',
  'avenue françois chardigny',
  'montée de saint-menet',
  'rue lepelletier',
  'rue rené d\'anjou',
  'boulevard berthier',
  'avenue de la grognarde',
  'boulevard pierre ménard',
  'boulevard maurice bourdet',
  'rue pierre doize',
  'tunnel saint-loup',
  'rue de roubaix',
  'boulevard bara',
  'rue albert einstein',
  'avenue françois mignet',
  'avenue corot',
  'boulevard henri fabre',
  'rue du commandant rolland',
  'traverse de la martine',
  'rue charles kaddouz',
  'place marceau',
  'place sadi carnot',
  'avenue des goumiers'
]);


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
const MONUMENT_NAMES_NORMALIZED = [
  "notre-dame de la garde",
  "cathedrale sainte-marie majeure dite de la major",
  "abbaye saint-victor",
  "palais longchamp",
  "mucem",
  "palais du pharo",
  "fort saint-jean",
  "fort saint-nicolas",
  "chateau d’if",
  "vieille charite",
  "hotel de ville",
  "ombriere du vieux-port",
  "gare saint-charles",
  "palais de la bourse",
  "bibliotheque de l’alcazar",
  "prefecture des bouches-du-rhone",
  "palais de justice",
  "theatre de la criee",
  "theatre du gymnase",
  "musee cantini",
  "musee d’histoire de marseille",
  "cité radieuse dite le corbusier",
  "arc de triomphe de la porte d’aix",
  "obelisque de mazargues",
  "bastide de la magalone",
  "basilique du sacre-coeur",
  "chapelle des bernardines - lycee thiers",
  "chateau borely",
  "chateau de la buzine",
  "consigne sanitaire",
  "eglise des chartreux",
  "fontaine cantini",
  "hopital caroline",
  "hotel de cabre",
  "maison diamantee",
  "maregraphe",
  "monument aux mobiles des bouches-du-rhone",
  "porte de l’orient",
  "palais des arts",
  "pavillon des chutes-lavie",
  "phare du planier",
  "statue de monseigneur de belsunce",
  "villa la palestine",
  "chapelle de Valbelle dite mosquee de l’arsenal des galeres",
  "halle puget",
  "immeuble des docks de la joliette",
  "statue de david",
  "fontaine estrangin",
  "fontaine des danaides",
  "silo d’arenc",
  "caserne du muy",
  "hôtel des postes",
  "gare de la blancarde",
  "villa gaby",
  "pouce de césar",
  "pagode phap-hoa",
  "château valmante",
  "église st-michel du camas",
  "monument à capazza et fondère",
  "palais omnisports",
  "stade vélodrome",
  "académie des sciences, lettres et arts de marseille",
  "château de château-gombert",
  "observatoire de marseille",
  "villa valmer",
  "théâtre sylvain",
  "sémaphore de callelongue",
  "hôtel dieu",
  "arbre de l’espérance",
  "château pastré",
  "monument aux rapatriés",
  "château grand-séminaire",
  "État-Major des marins-pompiers de marseille",
  "château de la reynarde",
  "château régis",
  "château ricard",
  "tour sainte",
  "cité des arts de la rue",
  "centre pénitentiaire des baumettes",
  "couvent levat",
  "friche de la belle-de-mai",
  "château berger",
  "chapelle saint-joseph du redon",
  "cimetière saint-pierre",
  "église saint-vincent-de-paul dite les réformés",
  "église grecque orthodoxe de la dormition de la mère de dieu",
  "tour cma cgm",
  "château de bois-luzy",
  "église saint-barnabé",
  "château forbin",
  "château périer",
  "villa bagatelle",
  "église sainte-eusébie",
  "banque de france",
  "château talabot",
  "église saint-barthélémy",
  "cathédrale apostolique arménienne des saints traducteurs",
  "cinéma l’alhambra",
  "église saint-pierre",
  "église saint-louis",
  "tombeau de camille olive",
  "couvent madeleine rémusat",
  "vestiges du telescaphe des goudes",
  "croix du sommet du massif de marseilleveyre",
  "le dome",
  "hotel du departement",
  "hotel de region",
  "eglise saint-joseph",
  "hotel roux de corse - lycee montgrand",
  "grande synagogue de marseille",
  "temple reforme grignan",
  "monument à gyptis et protis"
];

function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

// Quartier → arrondissement (étiquette d'affichage)
const ARRONDISSEMENT_PAR_QUARTIER = {
  // 1er arrondissement
  "Belsunce": "1er",
  "Le Chapitre": "1er",
  "Noailles": "1er",
  "Opéra": "1er",
  "Saint-Charles": "1er",
  "Thiers": "1er",

  // 2e arrondissement
  "Arenc": "2e",
  "Grands-Carmes": "2e",
  "Hôtel de Ville": "2e",
  "La Joliette": "2e",

  // 3e arrondissement
  "Belle-de-Mai": "3e",
  "Saint-Lazare": "3e",
  "Saint-Mauront": "3e",
  "La Villette": "3e",

  // 4e arrondissement
  "La Blancarde": "4e",
  "Les Chartreux": "4e",
  "Chutes-Lavie": "4e",
  "Cinq-Avenues": "4e",

  // 5e arrondissement
  "Baille": "5e",
  "Le Camas": "5e",
  "La Conception": "5e",
  "Saint-Pierre": "5e",

  // 6e arrondissement
  "Castellane": "6e",
  "Lodi": "6e",
  "Notre-Dame-du-Mont": "6e",
  "Palais-de-Justice": "6e",
  "Préfecture": "6e",
  "Vauban": "6e",

  // 7e arrondissement
  "Bompard": "7e",
  "Endoume": "7e",
  "Les Îles": "7e",
  "Le Pharo": "7e",
  "Roucas-Blanc": "7e",
  "Saint-Lambert": "7e",
  "Saint-Victor": "7e",

  // 8e arrondissement
  "Bonneveine": "8e",
  "Les Goudes": "8e",
  "Montredon": "8e",
  "Périer": "8e",
  "La Plage": "8e",
  "Pointe Rouge": "8e",
  "Le Rouet": "8e",
  "Sainte-Anne": "8e",
  "Saint-Giniez": "8e",
  "Vieille-Chapelle": "8e",

  // 9e arrondissement
  "Les Baumettes": "9e",
  "Le Cabot": "9e",
  "Carpiagne": "9e",
  "Mazargues": "9e",
  "La Panouse": "9e",
  "Le Redon": "9e",
  "Sainte-Marguerite": "9e",
  "Sormiou": "9e",
  "Vaufrèges": "9e",

  // 10e arrondissement
  "La Capelette": "10e",
  "Menpenti": "10e",
  "Pont-de-Vivaux": "10e",
  "Saint-Loup": "10e",
  "Saint-Tronc": "10e",
  "La Timone": "10e",

  // 11e arrondissement
  "Les Accates": "11e",
  "La Barasse": "11e",
  "Les Camoins": "11e",
  "Éoures": "11e",
  "La Millière": "11e",
  "La Pomme": "11e",
  "Saint-Marcel": "11e",
  "Saint-Menet": "11e",
  "La Treille": "11e",
  "La Valbarelle": "11e",
  "La Valentine": "11e",

  // 12e arrondissement
  "Les Caillols": "12e",
  "La Fourragère": "12e",
  "Montolivet": "12e",
  "Saint-Barnabé": "12e",
  "Saint-Jean-du-Désert": "12e",
  "Saint-Julien": "12e",
  "Les Trois Lucs": "12e",

  // 13e arrondissement
  "Chateau-Gombert": "13e",
  "La Croix Rouge": "13e",
  "Malpassé": "13e",
  "Les Médecins": "13e",
  "Les Mourets": "13e",
  "Les Olives": "13e",
  "Palama": "13e",
  "La Rose": "13e",
  "Saint-Jérôme": "13e",
  "Saint-Just": "13e",
  "Saint-Mitre": "13e",

  // 14e arrondissement
  "Les Arnavaux": "14e",
  "Bon-Secours": "14e",
  "Le Canet": "14e",
  "Le Merlan": "14e",
  "Saint-Barthélémy": "14e",
  "Saint-Joseph": "14e",
  "Sainte-Marthe": "14e",

  // 15e arrondissement
  "Les Aygalades": "15e",
  "Les Borels": "15e",
  "La Cabucelle": "15e",
  "La Calade": "15e",
  "Les Crottes": "15e",
  "La Delorme": "15e",
  "Notre-Dame-Limite": "15e",
  "Saint-Antoine": "15e",
  "Saint-Louis": "15e",
  "Verduron": "15e",
  "La Viste": "15e",

  // 16e arrondissement
  "L'Estaque": "16e",
  "Les Riaux": "16e",
  "Saint-André": "16e",
  "Saint-Henri": "16e"
};

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
    let art  = match[2].trim();

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
  const key = normalizeQuartierKey(label);
  arrondissementByQuartier.set(key, arr);
});

// Session en cours (rues)
let sessionStreets = [];
let currentIndex = 0;
let currentTarget = null;
let isSessionRunning = false;

// Timers + Pause + Chrono
let sessionStartTime   = null;
let streetStartTime    = null;

let isPaused           = false;
let pauseStartTime     = null;
let remainingChronoMs  = null;

let isChronoMode       = false;
let chronoEndTime      = null;

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
    // Autres modes : on les montre
    restartBtn.style.display = '';
    pauseBtn.style.display = '';
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
});

// ------------------------
// Carte
// ------------------------

function initMap() {
  map = L.map('map', {
    tap: true,              // ← nécessaire pour activer les interactions tactiles
    tapTolerance: IS_TOUCH_DEVICE ? 25 : 15,       // ← meilleure sensibilité mobile
    doubleTapZoom: true     // ← zoomer au double-tap
  }).setView([43.2965, 5.37], 13);
  
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles © Esri'
    }
  ).addTo(map);
}

// ------------------------
// Interface
// ------------------------

function initUI() {
  // Mode "doigt" pour mobile / tactile
  if (IS_TOUCH_DEVICE) {
    document.body.classList.add('touch-mode');
  }
  const restartBtn       = document.getElementById('restart-btn');
  const modeSelect       = document.getElementById('mode-select');
  const quartierBlock    = document.getElementById('quartier-block');
  const quartierSelect   = document.getElementById('quartier-select');
  const skipBtn          = document.getElementById('skip-btn');
  const pauseBtn         = document.getElementById('pause-btn');
    // Faux select "quartier"
  const quartierBtn   = document.getElementById('quartier-select-button');
  const quartierList  = document.getElementById('quartier-select-list');
  const quartierLabel = quartierBtn
    ? quartierBtn.querySelector('.custom-select-label')
    : null;

  const loginBtn         = document.getElementById('login-btn');
  const registerBtn      = document.getElementById('register-btn');
  const logoutBtn        = document.getElementById('logout-btn');
  const usernameInput    = document.getElementById('auth-username');
  const passwordInput    = document.getElementById('auth-password');

  if (modeSelect) {
    currentZoneMode = modeSelect.value;
  }
  updateModeDifficultyPill();

  // ----- Nouveau select personnalisé "zone de jeu" -----
const modeBtn = document.getElementById("mode-select-button");
const modeList = document.getElementById("mode-select-list");
const modeLabel = modeBtn.querySelector(".custom-select-label");

modeBtn.addEventListener("click", () => {
  modeList.classList.toggle("visible");
});

modeList.querySelectorAll("li").forEach(item => {
  item.addEventListener("click", () => {
    const value = item.dataset.value;

    // Mise à jour du label
    modeLabel.textContent = item.childNodes[0].textContent.trim();

    // Mise à jour pastille
    const pill = item.querySelector(".difficulty-pill").cloneNode(true);
    modeBtn.querySelector(".difficulty-pill").replaceWith(pill);

    // Mise à jour interne
    const fakeSelect = document.getElementById("mode-select");
    if (fakeSelect) {
      fakeSelect.value = value;

      // Correction essentielle :
      // déclenchement manuel du "change"
      fakeSelect.dispatchEvent(new Event("change"));
    }

    modeList.classList.remove("visible");
  });
});

  // ----- Select personnalisé "type de partie" -----
  const gameModeBtn   = document.getElementById("game-mode-select-button");
  const gameModeList  = document.getElementById("game-mode-select-list");
  const gameModeLabel = gameModeBtn
    ? gameModeBtn.querySelector(".custom-select-label")
    : null;
  const gameModeSelect = document.getElementById("game-mode-select");

  if (gameModeBtn && gameModeList && gameModeLabel && gameModeSelect) {
    gameModeBtn.addEventListener("click", () => {
      gameModeList.classList.toggle("visible");
    });

    gameModeList.querySelectorAll("li").forEach(item => {
      item.addEventListener("click", () => {
        const value = item.dataset.value;

        // Mise à jour du label (Classique / Marathon / Chrono / Lecture)
        gameModeLabel.textContent = item.childNodes[0].textContent.trim();

        // Mise à jour de la pastille (20 rues / 3 erreurs max / 1 minute / Apprentissage)
        const pillInList = item.querySelector(".difficulty-pill");
        if (pillInList) {
          const newPill = pillInList.cloneNode(true);
          const btnPill = gameModeBtn.querySelector(".difficulty-pill");
          if (btnPill) {
            btnPill.replaceWith(newPill);
          } else {
            gameModeBtn.appendChild(newPill);
          }
        }

        // Mise à jour du <select> caché (utilisé par getGameMode())
        gameModeSelect.value = value;

        // Si une session est en cours et qu'on change de mode, on la termine proprement
        if (isSessionRunning) {
          endSession();
        }

        // Met à jour la visibilité des boutons selon le mode
        updateGameModeControls();

        // Toujours : rembobiner la liste + fermer
        gameModeList.scrollTop = 0;           // <<< AJOUT
        gameModeList.classList.remove("visible");

        // Lecture : lancer APRÈS fermeture/layout stable
        if (value === 'lecture') {
          requestAnimationFrame(() => startNewSession());   // <<< MODIF MINIMALE
        }
      });
    });
  }

  // ----- Select personnalisé "quartier" (sans pastille) -----
  if (quartierBtn && quartierList && quartierLabel && quartierSelect) {
    // Ouverture / fermeture de la liste
    quartierBtn.addEventListener('click', () => {
      quartierList.classList.toggle('visible');
    });

    // Le contenu de la liste (les <li>) sera créé dans populateQuartiers()
    // On gérera là-bas les clics sur <li> pour mettre à jour le label et le <select> caché.
  }
  
// Ferme la liste déroulante si clic ailleurs
document.addEventListener("click", (e) => {
  // Zone de jeu
  if (modeBtn && modeList &&
      !modeBtn.contains(e.target) &&
      !modeList.contains(e.target)) {
    modeList.classList.remove("visible");
  }

  // Type de partie
  if (gameModeBtn && gameModeList &&
      !gameModeBtn.contains(e.target) &&
      !gameModeList.contains(e.target)) {
    gameModeList.classList.remove("visible");
  }

  // Quartier
  if (quartierBtn && quartierList &&
      !quartierBtn.contains(e.target) &&
      !quartierList.contains(e.target)) {
    quartierList.classList.remove("visible");
  }
});

  // Recharger l'utilisateur courant depuis le stockage local
  currentUser = loadCurrentUserFromStorage();
  updateUserUI();

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
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });
          // on laisse les handlers décider si le clic est pertinent (voir handleStreetClick)
          layer.options.interactive = true;
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
          layer.setStyle({
            color: base.color,
            weight: base.weight
          });
        });
      }
    });
  }

  // Auth events
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!username || !password) {
        showMessage('Pseudo et mot de passe requis.', 'error');
        return;
      }
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        const data = await res.json();
        currentUser = {
          id: data.user?.id,
          username: data.user?.username,
          token: data.token
        };
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showMessage('Connexion réussie.', 'success');
      } catch (err) {
        console.error('Erreur login :', err);
        showMessage('Erreur de connexion.', 'error');
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const username = (usernameInput?.value || '').trim();
      const password = passwordInput?.value || '';
      if (!username || !password) {
        showMessage('Pseudo et mot de passe requis.', 'error');
        return;
      }
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
          throw new Error('HTTP ' + res.status);
        }
        const data = await res.json();
        currentUser = {
          id: data.user?.id,
          username: data.user?.username,
          token: data.token
        };
        saveCurrentUserToStorage(currentUser);
        updateUserUI();
        showMessage('Compte créé et connecté.', 'success');
      } catch (err) {
        console.error('Erreur register :', err);
        showMessage('Erreur lors de la création du compte.', 'error');
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      currentUser = null;
      clearCurrentUserFromStorage();
      updateUserUI();
      showMessage('Déconnecté.', 'info');
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

  if (skipBtn) {
    skipBtn.style.display = 'inline-block';
  }
}

const infoEl = document.getElementById('street-info');
if (infoEl) {
  infoEl.textContent = '';
}

// ------------------------
// Tooltip "Score pondéré" (survol du ?)
// ------------------------
(function initWeightedScoreTooltip() {
  const btn  = document.getElementById('weighted-score-help-btn');
  const tip  = document.getElementById('weighted-score-help');
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
  const totalTimeSec  = (now - sessionStartTime) / 1000;
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

  updateTimeUI(totalTimeSec, streetTimeSec);

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
}

function loadStreets() {
  fetch('data/marseille_rues_enrichi.geojson')
    .then(response => {
      if (!response.ok) {
        throw new Error('Erreur HTTP ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      const features = (data.features || []).filter(f =>
        f.properties &&
        typeof f.properties.name === 'string' &&
        f.properties.name.trim() !== ''
      );

      features.forEach(f => {
        f.properties.name = f.properties.name.trim();
      });

      allStreetFeatures = features;
      console.log('Nombre de rues chargées :', allStreetFeatures.length);

      streetLayersById.clear();
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
          
          // Buffer tactile élargi pour les appareils tactiles
          addTouchBufferForLayer(layer);

          layer.on('mouseover', () => {
            const zoneMode = getZoneMode();
            const isMain = MAIN_STREET_NAMES.has(nameNorm);
            const selectedQuartier = getSelectedQuartier();
            const fq = feature.properties.quartier || null;

            // Rues secondaires ignorées en mode "rues principales"
            if ((zoneMode === 'rues-principales' || zoneMode === 'main') && !isMain) {
              return;
            }

            // Rues hors quartier ignorées en mode "quartier"
            if (zoneMode === 'quartier' && selectedQuartier && fq !== selectedQuartier) {
              return;
            }

            streetLayersById.forEach(l => {
              const n = normalizeName(l.feature.properties.name);
              if (n === nameNorm) {
                l.setStyle({
                  weight: 7,
                  color: '#ffffff'
                });
              }
            });
          });

          layer.on('mouseout', () => {
            const zoneMode = getZoneMode();
            const isMain = MAIN_STREET_NAMES.has(nameNorm);
            const selectedQuartier = getSelectedQuartier();
            const fq = feature.properties.quartier || null;

            if ((zoneMode === 'rues-principales' || zoneMode === 'main') && !isMain) {
              return;
            }
            if (zoneMode === 'quartier' && selectedQuartier && fq !== selectedQuartier) {
              return;
            }

            streetLayersById.forEach(l => {
              const n = normalizeName(l.feature.properties.name);
              if (n !== nameNorm) return;

              if (highlightedLayers && highlightedLayers.includes(l)) {
                return;
              }

              const base = getBaseStreetStyle(l);
              l.setStyle({
                weight: base.weight,
                color: base.color
              });
            });
          });

          layer.on('click', () => handleStreetClick(feature));
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
  fetch('data/marseille_monuments.geojson')
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

      features.forEach(f => {
        f.properties.name = f.properties.name.trim();
      });

      allMonuments = features;
      console.log('Nombre de monuments chargés :', allMonuments.length);

      if (monumentsLayer) {
        map.removeLayer(monumentsLayer);
        monumentsLayer = null;
      }

      monumentsLayer = L.geoJSON(
  { type: 'FeatureCollection', features: allMonuments },
  {
    pointToLayer: (feature, latlng) => {
      const marker = L.circleMarker(latlng, {
        radius: IS_TOUCH_DEVICE ? 11 : 7,
        color: '#1565c0',
        weight: 2,
        fillColor: '#2196f3',
        fillOpacity: 0.9
      });
      return marker;
    },
    onEachFeature: (feature, layer) => {
      layer.on('click', () => handleMonumentClick(feature, layer));
    }
  }
);
    refreshLectureTooltipsIfNeeded();
      // Si la zone active est déjà "monuments", on montre directement la couche
      if (getZoneMode() === 'monuments') {
        if (streetsLayer && map.hasLayer(streetsLayer)) {
          map.removeLayer(streetsLayer);
        }
        if (!map.hasLayer(monumentsLayer)) {
          monumentsLayer.addTo(map);
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
      const name = layer.feature?.properties?.name || '';
      if (!name) return;

      if (enabled) {
        if (!layer.getTooltip()) {
          layer.bindTooltip(name, {
            direction: 'top',
            sticky: !IS_TOUCH_DEVICE,
            opacity: 0.9,
            className: 'monument-tooltip'
          });
        }
        attachTapTooltip(layer);
      } else {
        detachTapTooltip(layer);
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
  fetch('data/marseille_quartiers_111.geojson')
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

    map.fitBounds(bounds, fitOptions);
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
  const quartierList   = document.getElementById('quartier-select-list');
  const quartierBtn    = document.getElementById('quartier-select-button');

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

  // Remplir la liste du faux select avec pastille
  if (quartierList) {
    quartierList.innerHTML = '';

    quartiers.forEach(q => {
      const li = document.createElement('li');
      li.dataset.value = q;

      // Nom du quartier
      const nameSpan = document.createElement('span');
      nameSpan.textContent = q;
      li.appendChild(nameSpan);

      // Pastille arrondissement (si dispo)
      const arrLabel = arrondissementByQuartier.get(normalizeQuartierKey(q));
      if (arrLabel) {
        const pill = document.createElement('span');
        pill.className = 'difficulty-pill difficulty-pill--arrondissement';
        pill.textContent = arrLabel;
        li.appendChild(pill);
      }

      li.addEventListener('click', () => {
        // Met à jour le label du bouton
        const labelSpan = quartierBtn
          ? quartierBtn.querySelector('.custom-select-label')
          : null;
        if (labelSpan) {
          labelSpan.textContent = q;
        }

        // Met à jour la pastille sur le bouton
        const liPill  = li.querySelector('.difficulty-pill');
        if (quartierBtn) {
          const btnPill = quartierBtn.querySelector('.difficulty-pill');
          if (liPill) {
            const newPill = liPill.cloneNode(true);
            if (btnPill) {
              btnPill.replaceWith(newPill);
            } else {
              quartierBtn.appendChild(newPill);
            }
          } else if (btnPill) {
            // Aucun arrondissement connu pour ce quartier → on enlève la pastille
            btnPill.remove();
          }
        }

        // Met à jour le <select> caché
        quartierSelect.value = q;
        // Déclenche le "change"
        quartierSelect.dispatchEvent(new Event('change'));

        // Ferme le menu
        quartierList.classList.remove('visible');
      });

      quartierList.appendChild(li);
    });

    // Label + pastille par défaut (premier quartier, si dispo)
    if (quartiers.length > 0 && quartierBtn) {
      const q0 = quartiers[0];
      const labelSpan = quartierBtn.querySelector('.custom-select-label');

      if (labelSpan) {
        labelSpan.textContent = q0;
      }

      const arrLabel0 = arrondissementByQuartier.get(normalizeQuartierKey(q0));
      if (arrLabel0) {
        const existingPill = quartierBtn.querySelector('.difficulty-pill');
        const newPill = document.createElement('span');
        newPill.className = 'difficulty-pill difficulty-pill--arrondissement';
        newPill.textContent = arrLabel0;

        if (existingPill) {
          existingPill.replaceWith(newPill);
        } else {
          quartierBtn.appendChild(newPill);
        }
      }

      quartierSelect.value = q0;
      // Pas de dispatch ici : tu gardes ton comportement actuel
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
  isSessionRunning      = false;
  isChronoMode          = false;
  chronoEndTime         = null;
  sessionStartTime      = null;
  streetStartTime       = null;
  isPaused              = false;
  pauseStartTime        = null;
  remainingChronoMs     = null;

  // Remet le mode de jeu sur "classique" côté logique
  const gameModeSelect = document.getElementById('game-mode-select');
  if (gameModeSelect) {
    gameModeSelect.value = 'classique';
  }

  // Met à jour le sélecteur custom "Type de partie"
  const gameModeBtn  = document.getElementById('game-mode-select-button');
  const gameModeList = document.getElementById('game-mode-select-list');

  if (gameModeBtn) {
    const label = gameModeBtn.querySelector('.custom-select-label');
    if (label) {
      if (gameModeList) {
        const item = gameModeList.querySelector('li[data-value="classique"]');
        if (item) {
          const textNode = item.childNodes[0];
          label.textContent = textNode && textNode.textContent
            ? textNode.textContent.trim()
            : 'Classique';

          const pillInList = item.querySelector('.difficulty-pill');
          if (pillInList) {
            const newPill = pillInList.cloneNode(true);
            const btnPill = gameModeBtn.querySelector('.difficulty-pill');
            if (btnPill) {
              btnPill.replaceWith(newPill);
            } else {
              gameModeBtn.appendChild(newPill);
            }
          }
        } else {
          label.textContent = 'Classique';
        }
      } else {
        label.textContent = 'Classique';
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
  correctCount   = 0;
  totalAnswered  = 0;
  summaryData    = [];
  weightedScore  = 0;
  errorsCount    = 0;

  isPaused          = false;
  pauseStartTime    = null;
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
    isSessionRunning      = false;
    isChronoMode          = false;
    chronoEndTime         = null;
    sessionStartTime      = null;
    streetStartTime       = null;
    currentTarget         = null;
    currentMonumentTarget = null;
    isPaused              = false;
    pauseStartTime        = null;
    remainingChronoMs     = null;

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
  if (skipBtn) skipBtn.style.display = 'inline-block';

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
  if (!btn) return;

  const gameMode = getGameMode();

  // En mode lecture : bouton totalement caché
  if (gameMode === 'lecture') {
    btn.style.display = 'none';
    return;
  } else {
    btn.style.display = '';
  }

  if (isSessionRunning) {
    btn.textContent = 'Arrêter la session';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-stop');
  } else {
    btn.textContent = 'Commencer la session';
    btn.classList.remove('btn-stop');
    btn.classList.add('btn-primary');
  }
}

function stopSessionManually() {
  if (!isSessionRunning) return;
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
  } else {
    pauseBtn.style.display = '';
  }

  if (!isSessionRunning) {
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    return;
  }

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

function handleStreetClick(clickedFeature) {
  const zoneMode = getZoneMode();

  if (zoneMode === 'monuments') return;

  // En mode "rues principales" : on ignore les rues non principales
  if (zoneMode === 'rues-principales' || zoneMode === 'main') {
    const nameNorm = normalizeName(clickedFeature.properties.name);
    if (!MAIN_STREET_NAMES.has(nameNorm)) {
      return;
    }
  }

  // En mode "quartier" : on ignore les rues hors quartier
  if (zoneMode === 'quartier') {
    const selectedQuartier = getSelectedQuartier();
    if (selectedQuartier &&
        clickedFeature.properties.quartier !== selectedQuartier) {
      return;
    }
  }

  if (isPaused) return;
  if (!currentTarget || sessionStartTime === null || streetStartTime === null) {
    return;
  }

  const gameMode = getGameMode();
  const now = performance.now();
  const streetTimeSec = (now - streetStartTime) / 1000;

  const clickedName   = normalizeName(clickedFeature.properties.name);
  const targetNameNorm= normalizeName(currentTarget.properties.name);

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
  }

  totalAnswered += 1;
  summaryData.push({
    name: currentTarget.properties.name,
    correct: isCorrect,
    time: streetTimeSec.toFixed(1)
  });

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

  const clickedName    = normalizeName(clickedFeature.properties.name);
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
}

  totalAnswered += 1;
  summaryData.push({
    name: answeredName,
    correct: isCorrect,
    time: itemTimeSec.toFixed(1)
  });

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
    layer.setStyle({ color: '#1565c0', fillColor: '#2196f3' });
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
    map.fitBounds(bounds, { padding: [60, 60] });
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
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

// ------------------------
// Fin de session & récapitulatif
// ------------------------

function endSession() {
  const now = performance.now();
  const totalTimeSec = sessionStartTime ? (now - sessionStartTime) / 1000 : 0;

  sessionStartTime      = null;
  streetStartTime       = null;
  currentTarget         = null;
  currentMonumentTarget = null;
  isSessionRunning      = false;
  isChronoMode          = false;
  chronoEndTime         = null;

  // Désactive explicitement le mode lecture
  isLectureMode = false;
  updateLayoutSessionState();

  isPaused          = false;
  pauseStartTime    = null;
  remainingChronoMs = null;

  updateStartStopButton();
  updatePauseButton();
  updateLayoutSessionState();

  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) skipBtn.style.display = 'inline-block';

  const total     = summaryData.length;
  const nbCorrect = summaryData.filter(r => r.correct).length;
  const percent   = total === 0 ? 0 : Math.round((nbCorrect / total) * 100);

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
    { value: 'all',       label: 'Tous' },
    { value: 'correct',   label: 'Corrects' },
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
  const pillEl  = document.getElementById('score-pill');

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

function updateTimeUI(totalTimeSec, streetTimeSec) {
  const totalEl  = document.getElementById('total-time');
  const streetEl = document.getElementById('street-time');

  if (totalEl) {
    totalEl.textContent  = totalTimeSec.toFixed(1) + ' s';
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

function loadCurrentUserFromStorage() {
  try {
    const raw = window.localStorage.getItem('marseille-quiz-user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Impossible de lire l’utilisateur stocké.', e);
    return null;
  }
}

function saveCurrentUserToStorage(user) {
  try {
    window.localStorage.setItem('marseille-quiz-user', JSON.stringify(user));
  } catch (e) {
    console.warn('Impossible de sauvegarder l’utilisateur.', e);
  }
}

function clearCurrentUserFromStorage() {
  try {
    window.localStorage.removeItem('marseille-quiz-user');
  } catch (e) {
    console.warn('Impossible de supprimer l’utilisateur stocké.', e);
  }
}

function updateUserUI() {
  const label = document.getElementById('current-user-label');
  const logoutBtn = document.getElementById('logout-btn');
  if (!label) return;

  if (currentUser && currentUser.username) {
    label.textContent = `Connecté : ${currentUser.username}`;
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
  } else {
    label.textContent = 'Non connecté.';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// ------------------------
// API: envoi du score & leaderboard
// ------------------------

function sendScoreToServer(payload) {
  try {
    fetch('/api/scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(currentUser?.token ? { 'Authorization': 'Bearer ' + currentUser.token } : {})
      },
      body: JSON.stringify({
        zone_mode: payload.zoneMode,
        quartier_name: payload.quartierName || null,
        game_mode: payload.gameMode,
        weighted_score: payload.weightedScore,
        percent_correct: payload.percentCorrect,
        total_time_sec: payload.totalTimeSec,
        items_answered: payload.itemsAnswered,
        items_correct: payload.itemsCorrect
      })
    }).catch(err => {
      console.error('Erreur envoi score :', err);
    });
  } catch (err) {
    console.error('Erreur envoi score (synchrone) :', err);
  }
}

function loadLeaderboard(zoneMode, quartierName, gameMode) {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  el.innerHTML = '<p>Chargement du leaderboard...</p>';

  const params = new URLSearchParams();
  params.set('zone_mode', zoneMode);
  params.set('game_mode', gameMode);
  if (quartierName) {
    params.set('quartier_name', quartierName);
  }

  fetch('/api/leaderboard?' + params.toString())
    .then(res => {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    })
    .then(data => {
      const entries = data.entries || [];
      if (!entries.length) {
        el.innerHTML = '<p>Aucun score pour ce mode.</p>';
        return;
      }

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>#</th><th>Joueur</th><th>Score pondéré</th><th>%</th><th>Temps</th></tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      entries.forEach((e, index) => {
        const tr = document.createElement('tr');
        const rank = e.rank != null ? e.rank : index + 1;
        const username = e.username || 'Anonyme';
        const score = typeof e.weighted_score === 'number' ? e.weighted_score.toFixed(1) : '-';
        const pc = typeof e.percent_correct === 'number' ? e.percent_correct + ' %' : '-';
        const time = typeof e.total_time_sec === 'number' ? e.total_time_sec.toFixed(1) + ' s' : '-';

        tr.innerHTML =
          `<td>${rank}</td>
           <td>${username}</td>
           <td>${score}</td>
           <td>${pc}</td>
           <td>${time}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      el.innerHTML = '';
      el.appendChild(table);
    })
    .catch(err => {
      console.error('Erreur leaderboard :', err);
      el.innerHTML = '<p>Erreur lors du chargement du leaderboard.</p>';
    });
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
