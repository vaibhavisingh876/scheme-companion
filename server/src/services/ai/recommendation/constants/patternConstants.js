/**
 * patternConstants.js
 *
 * Central pattern library for the entire recommendation pipeline.
 * Every regex here is used in: keywordFallback, scoringEngine, normalizer, and searchTextBuilder.
 *
 * IMPROVEMENT LOG:
 * - Massively expanded Hindi/Hinglish vocab across all occupation, intent, state patterns
 * - Added new special patterns: exServicemen, nri, tribal, transgender, artisan
 * - Added granular intent patterns for loan subtypes, housing, water, sanitation
 * - Patterns are ordered by specificity (most specific first) to ensure correct first-match
 */

export const PATTERNS = {
  // ── Occupation Patterns ───────────────────────────────────────────────────
  occupation: {
    // Student: all education stages, Indian exam names, coaching etc.
    student: /\bstudent\b|vidyarthi|chhatra|padhai|padhna|padhne|parhna|college|university|school|btech|b\.tech|mtech|m\.tech|engineering|degree|graduation|undergraduate|postgraduate|post.?grad|scholarship|tuition|fee|hostel|studying|pursuing|class\s*\d|ba\b|bsc\b|bcom\b|mba\b|mca\b|bca\b|llb\b|mbbs\b|polytechnic|iti\b|diploma|apprentice|research|fellowship|phd|ph\.d|ugc|jrf|srf|gate\b|jee\b|neet\b|upsc|mpsc|ssc\b|coaching|entrance exam|board exam|10th|12th|inter(mediate)?|higher\s*secondary|secondary\s*school|primary\s*school|anganwadi\s*child/i,

    // Farmer: crops, inputs, land, livestock, fisheries, forestry
    farmer: /\bfarm(er|ing|s|land)?\b|famer\b|kisan|kisaan|krishak|annadata|kheti|khetibadi|khet\b|fasal|agriculture|agri\b|crop(s|ping)?|horticulture|rice|wheat|paddy|irrigation|fertilizer|khaad|beej|seed\b|pesticide|soil|dairy|poultry|livestock|animal\s*husbandry|fisherman|fisheries|aquaculture|sericulture|floriculture|vegetable\s*grower|orchard|mango|sugarcane|cotton|pulses|oilseed|organic\s*farm|greenhouse|poly\s*house|drip\s*irrigation|sprinkler|tractor|harvesting|threshing|mandi|apmc|pm\s*kisan|kisan\s*credit|kcc\b|kissan|pashu|goat\b|sheep\b|poultry\s*farm|machhua|matsya|vanpradhan|tribal\s*farm|plantation/i,

    // Worker: construction, factory, BOCW, domestic, transport
    worker: /\bworker\b|majdoor|mazdoor|shramik|kamgar|labour\b|labourer|construction|artisan|carpenter|welder|mistri|mason|plumber|electrician|painter|factory\s*worker|mill\s*worker|domestic\s*worker|household\s*worker|gig\s*worker|daily\s*wage|daily\s*wager|anganwadi\s*worker|asha\s*worker|mid\s*day\s*meal|safai\s*karmachari|sanitation\s*worker|sweeper|ragpicker|waste\s*picker|rag\s*picker|beedi\s*worker|bidi\s*worker|handloom\s*weaver|weaver|powerloom|rickshaw\s*puller|auto\s*driver|truck\s*driver|transport\s*worker|mgnrega|nrega\b|bocw\b|building\s*worker/i,

    // Startup / Business / Self-employed
    startup: /\bstartup\b|entrepreneur|vyavsayi|vyapari|business(man|woman|person)?|shop\s*(owner|keeper)?|dukaan(daar)?|dukan\b|vyapar|msme\b|udyam\b|udyog\b|merchant|trader|retail(er)?|self.?employ(ed|ment)?|khud\s*ka\s*kaam|apna\s*kaam|rojgar\s*dhanda|micro\s*enterprise|small\s*enterprise|medium\s*enterprise|mudra\b|pmegp\b|stand\s*up\s*india|startup\s*india|innovation|incubat(or|ion)|e.?commerce\s*seller|manufacturer/i,

    // Unemployed / Job seekers
    unemployed: /unemployed|berozgaar(i)?|jobless|no\s*job|naukri\s*(nahi|nahin)|rojgaar\s*(nahi|nahin)|looking\s*for\s*job|job\s*(chahiye|dhundh|khoj)|kaam\s*(nahi|nahin)|bina\s*kaam|nikammi|nikamma|fresher\s*(hu|hoon|hai)|just\s*(graduated|passed)|pass\s*out|pass\s*kiya|abhi\s*(padhai|school|college)\s*khatam/i,

    // Housewife / Homemaker
    housewife: /housewife|homemaker|grihini|gruhini|gharelu(\s*mahila)?|ghar\s*pe\s*(rehna|reh|hai)|ghar\s*wali|ghar\s*chalati|stay.at.home|full.?time\s*mother|ghar\s*sambhalti/i,

    // Widow
    widow: /\bwidow\b|patavya|bereaved(\s*wife)?|husband\s*(died|dead|passed|deceased|nahi\s*raha|guzar\s*gaya|mar\s*gaya)|widow\s*pension|vidhwa|vidhwa\s*pension|pati\s*(nahi\s*raha|guzar|mar\s*gaya|deceased)|akeli\s*aurat|single\s*mother\s*(?:after|following)\s*death|death\s*of\s*(husband|spouse)\b/i,
  },

  // ── Intent Patterns ───────────────────────────────────────────────────────
  intent: {
    // Agriculture / Farmer
    farmer: /kisan|kisaan|krishak|kheti|fasal\b|khet\b|annadata|crop\s*insurance|fasal\s*bima|pmfby\b|kisan\s*credit|kcc\b|pm\s*kisan|soil\s*health|drip\s*irrigation|tractor\s*(subsidy|loan)|agriculture\s*(loan|subsidy|scheme)|pradhan\s*mantri\s*fasal/i,

    // Scholarship / Education funding
    scholarship: /scholarship|chatravritti|vidya\s*lakshmi|padhai\s*(ki\s*)?madad|madad.{0,10}padhai|fee\s*(reimbursement|waiver|help|subsidy)|tuition\s*(fee|support)|education\s*(loan|grant|support|aid)|student\s*(aid|loan|support|benefit)|stipend|post.?matric|pre.?matric|national\s*(merit|scholarship)|merit\s*(scholarship|list)|merit\s*cum\s*means|free\s*(education|college|school)|hostel\s*(fee|subsidy)|coaching\s*(free|subsidy|grant)|inspire\b|kvpy\b/i,

    // Medical / Treatment (disease, surgery, hospital)
    treatment: /ilaaj|treatment|dawai|hospital(ization)?|dawa\b|bimari|cancer|surgery|operation\b|chemo(therapy)?|radiation|tumor|tumour|oncology|dialysis|kidney\s*(failure|transplant)|heart\s*(surgery|attack|disease)|stroke|thalassemia|sickle\s*cell|rare\s*disease|tb\b|tuberculosis|hiv\b|aids\b|leprosy|physiotherapy|rehabilitation|ayushman|pmjay\b|rashtriya\s*arogya\b|niramaya\b/i,

    // Loan (generic / housing / education / business)
    loan: /\bloan\b|rin\b|karz\b|udhaar|credit\b|paisa\s*chahiye|paise\s*chahiye|financial\s*help|financial\s*assistance|mudra\s*loan|housing\s*loan|home\s*loan|ghar\s*(ke\s*liye\s*)?loan|business\s*loan|education\s*loan|msme\s*loan|bank\s*loan|interest\s*subsidy|guarantee\s*scheme|collateral.?free/i,

    // Job / Employment
    job: /naukri|rojgaar\b|job\b|employment|berozgaar|work\s*permit|skill\s*(training|development|india)|apprenticeship|internship|placement|govt\s*job|sarkari\s*naukri|private\s*job|pm\s*kaushal|pmkvy\b|ddugky\b/i,

    // Startup / Entrepreneurship
    "startup-funding": /startup|business\s*(loan|grant|support|scheme)|business\s*karna|dukaan\s*kholna|vyapar\s*shuru|apna\s*kaam|self.?employ|mudra\b|pmegp\b|stand\s*up\s*india|startup\s*india|udyam|msme\s*(loan|scheme|subsidy)|innovation\s*fund|seed\s*fund|venture/i,

    // Widow Support
    "widow-support": /\bwidow\b|vidhwa|widowed|bereaved|husband\s*(died|dead|nahi\s*raha|guzar\s*gaya|mar\s*gaya)|widow\s*pension|pati\s*ka\s*(nidhan|maut|intiqal)|akeli\s*(mahila|aurat)|death\s*of\s*(husband|spouse)/i,

    // Maternity / Pregnancy
    maternity: /pregnant|maternity|pregnancy|childbirth|delivery|antenatal|postnatal|neonate|newborn|breast.?feed(ing)?|neonatal|janani|shishu|prasav|suman\b|jsy\b|jssk\b|pmmvy\b|pradhan\s*mantri\s*matru|mamta\b|lalitpur|mother\s*child/i,

    // Disability
    disability: /disab(led|ility|ilities)?|handicap(ped)?|divyang|pwd\b|differently.?abled|physically.?challenged|mental.?retard(ation)?|cerebral\s*palsy|autism|blind(ness)?|deaf(ness)?|dumb\b|mute\b|locomotor|amputation|leprosy.?cured|low\s*vision|specially.?abled|saksham\b/i,

    // Marriage / Wedding assistance
    marriage: /marriage|vivah|shaadi|shadi|nikah\b|wedding|bride|groom|dulhan|dulha|kanyadaan|beti\s*ki\s*shaadi|beti\s*vivah|shaadi\s*anudan|marriage\s*(grant|assistance|support)|mukhyamantri\s*kanya\s*vivah/i,

    // Death / Funeral assistance
    death: /death\s*(assistance|grant|benefit|compensation)|antim\s*anudan|funeral|kabir\s*anthyesthi|breadwinner\s*(died|dead|death)|accidental\s*death|natural\s*death|shok|mourning\s*support|family\s*benefit\s*scheme|mrityu\b/i,

    // Housing / Shelter
    housing: /house\b|ghar\b|makaan\b|awas\b|housing|shelter|home\s*(loan|subsidy|grant)|pmay\b|pradhan\s*mantri\s*awas|rural\s*housing|urban\s*housing|pucca\s*ghar|kutcha|temporary\s*house|slum|jhuggi|flat|apartment\s*subsidy/i,

    // Sanitation / Water / Hygiene
    sanitation: /toilet\b|shauchalay|swachh|sanitation|water\s*(supply|connection|purification)|nal\s*jal|jal\s*jeevan|drinking\s*water|open\s*defecation|odf\b|hygiene|clean\s*india/i,

    // Pension / Social Security
    pension: /pension\b|old\s*age\s*pension|vridha\s*pension|senior\s*citizen\s*(pension|allowance)|nsap\b|ignoaps\b|igndps\b|social\s*security|provident\s*fund|pf\b|epf\b|atal\s*pension|nps\b/i,
  },

  // ── State Patterns ────────────────────────────────────────────────────────
  state: {
    uttarpradesh:     /\bup\b|u\.p\.|uttar\s*pradesh|utar\s*pradesh|lucknow|kanpur|agra\b|varanasi|allahabad|prayagraj/i,
    madhyapradesh:    /\bmp\b|m\.p\.|madhya\s*pradesh|bhopal|indore|gwalior|jabalpur/i,
    delhi:            /\bdelhi\b|\bdilli\b|nct\s*delhi|new\s*delhi/i,
    maharashtra:      /\bmh\b|maharashtra|mumbai|pune|nagpur|nashik|aurangabad|thane/i,
    rajasthan:        /rajasthan|\braj\b|jaipur|jodhpur|udaipur|kota\b/i,
    bihar:            /\bbr\b|\bbihar\b|patna\b|gaya\b|muzaffarpur/i,
    westbengal:       /west\s*bengal|\bwb\b|paschim\s*banga|kolkata|calcutta|howrah/i,
    punjab:           /\bpb\b|\bpunjab\b|chandigarh\b|ludhiana|amritsar/i,
    haryana:          /\bhr\b|\bharyana\b|gurugram|gurgaon|faridabad|hisar/i,
    gujarat:          /\bgj\b|\bgujarat\b|gujrat|ahmedabad|surat\b|baroda|vadodara|rajkot/i,
    karnataka:        /\bkar\b|\bkarnataka\b|bengaluru|bangalore|mysore|hubli/i,
    tamilnadu:        /\btn\b|tamil\s*nadu|tamilnadu|chennai|coimbatore|madurai/i,
    telangana:        /\btg\b|\btelangana\b|hyderabad/i,
    andhrapradesh:    /\bap\b|andhra\s*pradesh|visakhapatnam|vizag\b|vijayawada/i,
    uttarakhand:      /\buk\b|uttarakhand|uttaranchal|dehradun|haridwar/i,
    chhattisgarh:     /\bcg\b|chhattisgarh|chattisgadh|raipur\b|bilaspur/i,
    odisha:           /\bodisha\b|\borissa\b|bhubaneswar|cuttack/i,
    assam:            /\bassam\b|guwahati|dibrugarh/i,
    jammukashmir:     /\bjk\b|\bjammu\b|\bkashmir\b|srinagar|j\s*&\s*k|j\s*and\s*k/i,
    jharkhand:        /\bjh\b|\bjharkhand\b|ranchi\b|jamshedpur/i,
    himachalpradesh:  /\bhp\b|himachal\s*pradesh|shimla\b|manali/i,
    kerala:           /\bkerala\b|thiruvananthapuram|kochi\b|kozhikode/i,
    goa:              /\bgoa\b|panaji/i,
    manipur:          /\bmanipupr\b|\bmanipuri?\b|imphal/i,
    meghalaya:        /\bmeghalaya\b|shillong/i,
    tripura:          /\btripura\b|agartala/i,
    sikkim:           /\bsikkim\b|gangtok/i,
    arunachalpradesh: /arunachal\s*pradesh|itanagar/i,
    nagaland:         /\bnagaland\b|kohima/i,
    mizoram:          /\bmizoram\b|aizawl/i,
    chandigarh:       /\bchandigarh\b/i,
    puducherry:       /\bpuducherry\b|\bpondicherry\b|\bpy\b/i,
    ladakh:           /\bladakh\b|leh\b/i,
  },

  // ── Special / Niche Group Patterns ────────────────────────────────────────
  special: {
    disability:    /disab(led|ility|ilities)?|handicap(ped)?|divyang\b|pwd\b|differently.?abled|physically.?challenged|mentally.?challenged|cerebral\s*palsy|autism|blind(ness)?|deaf(ness)?|\bdumb\b|mute\b|locomotor|amputation|leprosy.?cured|low\s*vision|specially.?abled|saksham\b|visual\s*impairment|hearing\s*impairment|speech\s*impairment/i,
    widow:         /\bwidow\b|patavya|bereaved(\s*wife|\s*spouse)?|husband\s*(died|dead|passed\s*away|deceased|nahi\s*raha|guzar\s*gaya|mar\s*gaya)|widow\s*pension|vidhwa|pati\s*(nahi|guzar|mar\s*gaya|deceased)|widow\.s|widowed|surviving\s*spouse/i,
    pregnancy:     /pregnant|maternity|pregnancy|childbirth|delivery|antenatal|postnatal|neonate|newborn|lactating|nursing\s*mother|breast.?feed|garbhavati|prasav|prasuti/i,
    journalist:    /journalist|reporter|press\s*worker|media\s*worker|correspondent|accredited\s*journalist|print\s*media|tv\s*journalist|photojournalist/i,
    sports:        /sportsperson|athlete|\bplayer\b|sportsman|sportswoman|national\s*games|olympic|para.?olympic|sports\s*(award|fund|welfare)|khiladi|khel\b|tournament|medal/i,
    senior:        /senior\s*citizen|old\s*age|elderly|60\s*years|above\s*60|aged\s*person|vridha\b|vridh\b|vayoshreshtha|budhapa|budhape|60\s*saal|60\s*se\s*upar|aged\b|pensioner\b|retire(d|ment)/i,
    medical:       /cancer|chemo(therapy)?|treatment|ilaaj|hospital|surgery|operation|tumor|tumour|oncology|dawai\b|bimari|illness|disease|dialysis|transplant|cardiac|stroke|tbr?\b|tuberculosis|hiv\b|aids\b/i,
    exServicemen:  /ex.?service(man|men|women|person)|veteran\b|sainik\b|defence\s*personnel|\barmy\b|\bnavy\b|air\s*force|\bfauji\b|military\s*(service|veteran)|rpf\b|rpsf\b|crpf\b|cisf\b|bsf\b|itbp\b|ssb\b|capf\b|coast\s*guard|echs\b|ksb\b|zila\s*sainik/i,
    nri:           /overseas\s*indian|nri\b|non.?resident\s*indian|pravasi\s*bharatiya|abroad|foreign\s*country|diaspora/i,
    tribal:        /tribal\b|adivasi|scheduled\s*tribe|\bst\b(\s+community)?|van\s*bandhu|forest\s*dweller|primitive\s*tribe|particularly\s*vulnerable/i,
    transgender:   /transgender|transsexual|kinnar|hijra\b|third\s*gender|trans\s*person|gender\s*minority/i,
    artisan:       /artisan|craftsman|craftsperson|karigar|shilpkar|handicraft|handloom|pottery|weaving|embroidery|block\s*print|wood\s*craft/i,
  },
};