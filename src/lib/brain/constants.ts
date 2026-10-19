import type { ScriptFamily } from "./types";

export const STRONG_HINDI_ONLY =
  /\b(yaar|arre|accha|matlab|phir|hoon|karo|kyun|kaisa|kaise|waise|batao|suno|thoda|abhi|kahan|hota|hoti|dekhna|ruko|pehle|baad|seedha|acha|achi|baat|baar|zyada|bahut|theek|bilkul|samajh)\b/;

export const ROMANIZED_LANG_PATTERNS: Record<string, RegExp> = {
  kannada:
    /\b(yenu|enu|yen|madtidiya|madtidya|madtideya|maadtidya|madtidivi|madtiddhiya|hogthini|hogthinni|hothini|barthinni|barthini|bartheeni|haege|hege|hyege|hegidira|hegidiya|hegidiyya|yaako|yaake|yake|nimge|nimage|ninge|nangu|nange|thumba|tumba|tumba dhanyavad|beka|beku|bekku|irthini|irthinni|irthiya|chennagi|chennagide|olle|oLLe|swalpa|summane|hogona|barona|nivu|beda|heli|madli|kelasa|madathini|maadthini|madthini|karthe|irli|kanthe|yen madtidya|yenu madtidya|enu madtidya|helidru|namm|namge|hogbeda|barbeku|madli beku|adu onde|nanna jothe|nim jothe|illi baa|enu aagu|haeg irtha|swalpa iru|jothe iru|thumba chennag|chennag ide|yenagtha|yenaithe|namaskara|haudhu|houdu|illa|gothilla|gottilla|khushi|yaaru|illi|alli|elli|nodi|keli|nodona|keltiya|yavaga|oota|aitha|ayithu|aithu|maraya|alwa|alvo|maccha|macha|nange|yeno|guru|magane|maga|hogi|banni|houda|allva|gothu|gottu|nodappa|nodri)\b/i,
  tamil:
    /\b(enna pannre|enna panre|enna panra|enna pandra|epdi iruka|epdi irukka|epdi iruke|eppo|romba nalla|romba|konjam|illai|paru|paaru|irukken|irukka|iruken|iruku|vandhaen|vanthaen|poren|poran|vaaren|thevai|ennada|ennadi|machan|machaan|machi|machee|semma|semmaya|rasikkiren|theriyum|therila|teriyala|paathukko|seri pa|vanakkam|kavalai|nalla iruka|solluren|solluriya|vanthutten|solluven|puriyudhu|puriyala|poi varen|yaar|nee|neeyum|unakku|enakku|onnum|kaalai vanakkam|maalai vanakkam|paakalam|eppo varuva|epdi|romba thanks|vera level|vera level da|irukka|inga iru|seiyanum|vendaam|vendaama|paravillai|theriyuma|teriyuma|saptingaya|saaptingaya|saaptiya|saptiya|ama|aama|seri|apram|apparam|ennachu|ennacho|ethuku|edhuku|inga|anga|enga|vanga|ponga|solunga|purinjudha|puriyudha|pudichiruka|thaan|dhan|dan|thuki|panna|pannu|varum|varan|varadhu|ille|poda|podi|vaa|po|kaduppu|mokka|adhu|ithu|ethu|athu|sollu|naan|avan|avanu|avanga|ok\s+da|aama\s+da|seri\s+da|enna\s+da|illa\s+da|yes\s+da|no\s+da|unaku)\b/i,
  telugu:
    /\b(ela unnav|ela unnaru|ela unna|bagunnava|bagunava|bagunnara|bagunnaraa|bagunnani|tinnara|thinnara|tinnava|thinnava|avuna|avunu|kadu|kaadu|evaru|eppudu|ekkada|akkada|ikkada|emiti|entha|enti|yenti|chudandi|vinandi|alage|alaage|manchidhi|cheppu|cheppandi|ledu|ledhu|chala baaga|chala|matladatam|matadatam|vellandi|randi|nenu|memu|vaddu|anipistundi|anipistunna|cheppandi|cheppanu|vachanu|vachindi|potunna|chesanu|chesindi|emi chesaru|emi chestunav|na tho|mee tho|cheddam ra|bagundi|kaadu|kaadhu|ikkade|akkade|emi|yemi|ra baby|ra|okate|ippudu|malli|tarvata|ante|evaru|emanna|emantav|manchiga|manchidi|okka|okasari|cheppara|cheppudu|vinte|vintu|vellu|vasthav|vastav|mama|mava|chup|pora|poradi|anukunta|anukuntunna|kadha|kada)\b/i,
  marathi:
    /\b(kay karto|kay karte|kaay karat|aamhi|amhi|tumhi|tumcha|naka|nako|zalay|zale|zalay ka|aplya|mazi|maza|kashala|bagh na|bagh|ahe ka|majha|aamcha|tumhala|mi ithe|boluya|karu|zala|kadhiye|kuthay|navta|hota|hoti|chalto|chalte|jaato|jaate|yeto|yete|tumcha kasa|mala sang|aplya la|tumhi kuthay|kasa ahe|kaay zhalaa|kase ahe|kothe gela|kothe geli|nako karu|nako re|aalo|gelo|alo|gelo|bhau|dada|tai|shikto|shikte)\b/i,
  bengali:
    /\b(ki korcho|ki korbe|ki korish|kemon acho|kemon ache|kemon achish|thako|thakbe|hobe|amake|jabo|ashbo|bhalo lage|bhalo nei|ki holo|ki hoye|tumi|toke|tomake|amader|tomader|dekhchi|dekhbo|bolchi|bolbo|sunchi|sunbo|onek dhonnobad|ektu|onek|sundor|jai|asho|bolo|shono|jani|boro|choto|valo|bhalo|kothay|khanay|bolish|kothai|ki bolcho|ki bolbe|khabar|dada|didi)\b/i,
  gujarati:
    /\b(kem cho|kem chho|kemcho|hu chu|hu ahu|tamne|tane|chhe|che|nathi|aave|aavse|jaay|jase|saru|tamara|mara|amara|avo|jao|samajhyo|ketlu|gamyu|na gamyu|thay che|kahevay|karsho|chalse|tamaro|tamari|maro|mari|avse|jashe|shu thay|shu che|kai rite|kai nathi|kem nathi|su kare|khabar|bhai|ben)\b/i,
  malayalam:
    /\b(enthu|entha|enth|evide|evidey|njan|und|ille|pokunnu|pokum|varunnundo|varum|valare|sheriyaa|sheri|kollam|mone|mole|parayan|parayuka|kazhivu|vayya|venam|venda|ningade|njande|avide|ivide|cheyyunnu|shubharaatri|ayyo|enthinaanu|enthaa|nokku|poya|vanu|ningal|onn|onnum|ingott|angott|parayaamo|parayille|sheriyano|kollam alle|evide poyi|engott poya|njan varu|varunnu|aanu|alle|alla|sugamano|kazhicho)\b/i,
  punjabi:
    /\b(ki haal ae|menu|tenu|tainu|kithey|kiddhan|hunna|sohna|sohni|dasso|dass|hanji|chalda|chaldi|lagda|lagdi|milda|mildi|tussi|tusi|sadi|saada|kiddan|vadiya|bahut vadiya|akhan|vekhna|aaya|ayi|gaya|gayi|dass main|ki gall|ki ho gaya|ki hoea|nahi karna|dass ji|ki lagda|ki lagna|hegi|hoga|banunga|banegi|ki sochdi|ki sochda|koi gall nahi|gall kar|kive ho|bhaijaan|veerji|veere)\b/i,
  odia:
    /\b(kemiti|thiku|thika|ahu|tora|toma|ame|aapana|kana koruchha|kemiti achha|jau|aasu|kahile|kuthare|dekhilaa|bolilaa|sunilaa|jania|hoiba|bhala nahi|mo|thiku achi|kemiti acha|kana hela|ki kari|ki kariba|thara|ahe|nahin|nahi ahe|bhai|bhala)\b/i,
};

export const SCRIPT_FAMILY_MAP: Record<string, ScriptFamily> = {
  kannada: "south_indian",
  tamil: "south_indian",
  telugu: "south_indian",
  marathi: "devanagari",
  bengali: "east_indic",
  gujarati: "east_indic",
  malayalam: "south_indian",
  punjabi: "gurmukhi",
  odia: "east_indic",
};

export const DISPLAY_NAME_MAP: Record<string, string> = {
  kannada: "Kannada",
  tamil: "Tamil",
  telugu: "Telugu",
  marathi: "Marathi",
  bengali: "Bengali",
  gujarati: "Gujarati",
  malayalam: "Malayalam",
  punjabi: "Punjabi",
  odia: "Odia",
};

export const MEDIA_REQUEST_PATTERN =
  /\b(porn|xxx|nude\s+(?:pic|photo|video|selfie)|nudes\b|naked\s+(?:pic|photo|video|selfie)|explicit\s+(?:video|content|photo)|sex\s+video|adult\s+video|send\s+(?:naked|nude|explicit)\s+(?:pic|photo|video|selfie))\b/i;
export const INTIMATE_TALK_PATTERN =
  /\b(fuck\s*(?:me|u|you|kar|karo|mujhe)|sex\s*kar(?:te|na|o)?|chod(?:o|na|te)?|lund\b|choot\b|gaand\b|blowjob|handjob|fingering|horny\s*(?:babe|baby|af|yaar)?|turn(?:ed)?\s*(?:me\s*)?on|dirty\s*talk|touch\s*(?:me|you)\s*(?:there|all\s+over)?|make\s*(?:me\s*)?(?:cum|moan)|seduce\s*me|tease\s*me\s*(?:more|please)?)\b/i;
export const RUDE_PATTERN =
  /\b(shut up|stfu|idiot|stupid|bitch|slut|randi|madarchod|chutiya|bc\b|mc\b|behave|obey|slave|haramzada|bevkoof|gaandu|kamina|harami)\b/i;
export const FLIRT_PATTERN =
  /\b(sexy|hot\b|beautiful|pretty|cute(?:\s+face)?|you'?re\s*(?:so\s*)?(?:pretty|beautiful|hot|cute)|i\s*love\s*(?:you|u)\b|miss\s*(?:you|u)\b|kiss|hug|cuddle|romantic|baby\b|sweetheart|darling|flirt|my\s*girl|ur\s*mine|muah|bae\b|pyari|pyaro|azhagi|sundari|sundara|cheli|bangaram|sona|jaan|chaku)\b/i;