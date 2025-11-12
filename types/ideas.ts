// types/ideas.ts
export interface Category {
  name: string
  ideas: {
    title: string
    prompt: string
  }[]
}

export const categories: Category[] = [
  {
    name: "E-commerce",
    ideas: [
      { title: "Handmade Crafts Store", prompt: "Develop a responsive e-commerce platform for artisanal handmade crafts, featuring intuitive product categorization, secure shopping cart functionality, Stripe payment gateway integration, and optimized mobile experience." },
      { title: "Vintage Clothing Shop", prompt: "Design an elegant online boutique specializing in vintage apparel, incorporating high-resolution image galleries, comprehensive size guides, user wishlist management, and automated email marketing capabilities." },
      { title: "Electronics Marketplace", prompt: "Engineer a robust multi-vendor marketplace for consumer electronics, including advanced seller dashboards, customer review systems, dynamic search and filtering tools, and real-time live chat support." },
      { title: "Grocery Delivery App Landing", prompt: "Craft a compelling landing page for a premium grocery delivery service, highlighting real-time order tracking, personalized promotional code application, and seamless subscription management features." },
      { title: "Bookstore with Recommendations", prompt: "Construct an intelligent online bookstore leveraging AI-driven personalized recommendations, secure user account management, and efficient digital content delivery for e-books and audiobooks." },
      { title: "Fashion Boutique", prompt: "Build a sophisticated fashion retail website with interactive lookbooks, virtual fitting room simulations, and seamless social media integration for enhanced user engagement." },
      { title: "Art Supplies Store", prompt: "Create a comprehensive e-commerce solution for professional art supplies, featuring embedded tutorial resources, curated bundle offerings, and dedicated artist profile showcases." },
      { title: "Subscription Box Service", prompt: "Develop a customizable subscription box platform with interactive product selection quizzes, subscription progress visualization, and automated renewal notifications." },
      { title: "Tech Gadgets Shop", prompt: "Design a high-tech gadget retail site with detailed specification comparison tools, embedded product demonstration videos, and strategic affiliate partnership integrations." },
      { title: "Home Decor Marketplace", prompt: "Engineer a vibrant marketplace for home decor items, incorporating augmented reality preview functionalities, verified vendor profiles, and seasonal collection curation." }
    ]
  },
  {
    name: "Portfolio",
    ideas: [
      { title: "Creative Designer Portfolio", prompt: "Design a minimalist portfolio website for a creative graphic designer, showcasing interactive project galleries, in-depth case study documentation, and streamlined contact inquiry forms." },
      { title: "Photographer Showcase", prompt: "Develop a visually immersive portfolio for professional photographers, featuring lightbox-enabled image galleries, client testimonial integrations, and integrated booking calendar system." },
      { title: "Developer Resume Site", prompt: "Build a modern personal branding site for software developers, embedding live code demonstrations, GitHub repository linkages, and interactive skill proficiency visualizations." },
      { title: "Writer's Blog Portfolio", prompt: "Construct a literary portfolio with curated article excerpts, advanced reading analytics, and opt-in newsletter subscription mechanisms for audience growth." },
      { title: "Architectural Firm Portfolio", prompt: "Engineer a professional architecture firm showcase with high-fidelity 3D renderings, project timeline infographics, and comprehensive team biography sections." },
      { title: "Musician Demo Reel", prompt: "Create an engaging music portfolio site with embedded audio playback controls, dynamic tour scheduling displays, and cross-linked merchandise e-commerce sections." },
      { title: "Fitness Trainer Profile", prompt: "Design a motivational fitness trainer website featuring workout video libraries, client transformation galleries, and automated session scheduling tools." },
      { title: "Chef Recipe Portfolio", prompt: "Develop a culinary professional's portfolio with interactive recipe card layouts, detailed ingredient sourcing information, and high-production-value tutorial videos." },
      { title: "Marketer Case Studies", prompt: "Build a results-oriented marketing portfolio incorporating data-rich infographics, interactive ROI calculation widgets, and optimized lead generation forms." },
      { title: "Artist Digital Gallery", prompt: "Construct an interactive digital art gallery for contemporary artists, with zoomable artwork interfaces and blockchain-based NFT minting functionalities." }
    ]
  },
  {
    name: "Blog",
    ideas: [
      { title: "Tech News Blog", prompt: "Develop a dynamic technology news blog with sophisticated content categorization, integrated search engine, RSS syndication feeds, and targeted advertising placements." },
      { title: "Travel Adventure Blog", prompt: "Design an inspirational travel storytelling platform with multimedia photo journals, detailed itinerary planners, interactive world maps, and affiliate travel booking integrations." },
      { title: "Lifestyle Tips Blog", prompt: "Create a wellness-focused lifestyle blog featuring daily advisory content, interactive user polls, moderated comment threads, and personalized email digest subscriptions." },
      { title: "Food Recipe Blog", prompt: "Engineer a culinary inspiration site with advanced ingredient-based search filters, nutritional analysis breakdowns, and printable recipe export functionalities." },
      { title: "Fitness Motivation Blog", prompt: "Build an empowering fitness community blog with customizable workout regimen planners, user progress monitoring dashboards, and moderated discussion forums." },
      { title: "Personal Finance Blog", prompt: "Construct a financial literacy resource with interactive budgeting calculators, real-time market data trackers, and premium newsletter advisory services." },
      { title: "Gaming Reviews Blog", prompt: "Develop a gaming enthusiast hub with in-depth review analyses, high-resolution screenshot galleries, competitive leaderboard integrations, and community Discord linkages." },
      { title: "Parenting Advice Blog", prompt: "Design a supportive parenting guidance platform with developmental milestone trackers, expert Q&A forums, and extensive resource knowledge bases." },
      { title: "Eco Living Blog", prompt: "Create a sustainability advocacy site with step-by-step DIY instructional guides, carbon footprint assessment tools, and curated eco-friendly brand partnerships." },
      { title: "Book Reviews Blog", prompt: "Engineer a literary critique platform with standardized rating systems, annual reading challenge trackers, Goodreads API synchronizations, and exclusive author interview features." }
    ]
  },
  {
    name: "Landing Page",
    ideas: [
      { title: "SaaS Product Launch", prompt: "Design a conversion-optimized landing page for a cutting-edge SaaS application, incorporating hero section explainer videos, tiered pricing breakdowns, and high-impact waitlist enrollment forms." },
      { title: "Event Conference Page", prompt: "Develop a professional conference promotional site with detailed agenda timelines, prominent speaker biography highlights, integrated ticket purchasing portals, and live streaming embed capabilities." },
      { title: "Mobile App Promo", prompt: "Craft an engaging mobile application launch page featuring annotated screenshot carousels, key functionality spotlights, and direct app store download linkages." },
      { title: "Non-Profit Fundraising", prompt: "Build an emotionally resonant fundraising landing for charitable initiatives, showcasing beneficiary impact narratives, secure donation processing forms, and real-time campaign progress indicators." },
      { title: "Course Enrollment Page", prompt: "Engineer an educational course enrollment funnel with comprehensive curriculum overviews, verified learner testimonials, and streamlined checkout enrollment workflows." },
      { title: "Startup Pitch Page", prompt: "Design a compelling startup pitch deck website with structured problem-solution frameworks, executive team introductions, and confidential investor outreach mechanisms." },
      { title: "Webinar Registration", prompt: "Create a targeted webinar invitation page with session topic previews, expert speaker credentials, and calendar synchronization integration for seamless registrations." },
      { title: "Beta Product Teaser", prompt: "Develop an intrigue-building beta product reveal site with gated email capture mechanisms, progressive feature unveilings, and social proof testimonial integrations." },
      { title: "Holiday Sale Page", prompt: "Construct a festive holiday promotion landing with dynamic countdown timers, curated product recommendation grids, and intelligent cart recovery notifications." },
      { title: "Brand Rebrand Reveal", prompt: "Design a narrative-driven rebranding announcement page with comparative before-and-after visual elements, brand evolution timelines, and interactive feedback solicitation forms." }
    ]
  },
  {
    name: "SaaS Dashboard",
    ideas: [
      { title: "Project Management Dashboard", prompt: "Engineer a comprehensive project management SaaS interface with drag-and-drop Kanban visualizations, role-based task delegation, and insightful performance analytics dashboards." },
      { title: "CRM Client Tracker", prompt: "Develop an advanced CRM platform featuring centralized contact databases, visual sales pipeline management, automated email outreach sequences, and customizable reporting suites." },
      { title: "Analytics Overview", prompt: "Build a data-centric analytics dashboard with live metric streaming, modular widget customizations, and versatile data export functionalities for enterprise users." },
      { title: "Inventory Management", prompt: "Design an efficient inventory control system with real-time stock level monitoring, integrated supplier management portals, and proactive low-inventory alert notifications." },
      { title: "Team Collaboration Hub", prompt: "Create a unified team productivity hub incorporating threaded chat channels, secure file collaboration tools, and centralized activity timeline feeds." },
      { title: "Financial Reporting Tool", prompt: "Engineer a sophisticated financial oversight dashboard with automated profit-and-loss statements, predictive forecasting models, and interactive budget allocation planners." },
      { title: "E-learning Admin Panel", prompt: "Develop an e-learning administration console with enrollment analytics, automated quiz grading systems, and individualized learner progress reporting tools." },
      { title: "Support Ticket System", prompt: "Build a scalable customer support orchestration dashboard featuring prioritized ticket queuing, agent workload distribution, and service level agreement compliance trackers." },
      { title: "HR Employee Portal", prompt: "Design a comprehensive HR management portal with streamlined onboarding workflows, performance evaluation frameworks, and consolidated payroll summary views." },
      { title: "Marketing Campaign Tracker", prompt: "Create a marketing intelligence dashboard with campaign performance ROI analytics, multivariate A/B testing modules, and granular audience segmentation capabilities." }
    ]
  },
  {
    name: "Restaurant",
    ideas: [
      { title: "Italian Bistro Menu Site", prompt: "Develop an authentic Italian bistro website with sophisticated online reservation systems, visually appealing menu galleries, and executive chef professional biographies." },
      { title: "Fast Food Ordering App", prompt: "Engineer a streamlined fast-casual ordering platform with intuitive mobile-first interfaces, GPS-enabled delivery tracking, and tiered loyalty rewards programs." },
      { title: "Fine Dining Reservation", prompt: "Design an upscale fine dining reservation site featuring curated tasting menu explorations, sommelier-recommended wine pairings, and exclusive event scheduling calendars." },
      { title: "Cafe Loyalty Program", prompt: "Build a community-oriented cafe website with digital punch card reward systems, seasonal beverage innovation showcases, and geolocation-based store finder tools." },
      { title: "Food Truck Locator", prompt: "Create a mobile-responsive food truck dispatch site with integrated GPS mapping, daily menu rotation updates, and real-time social media content streams." },
      { title: "Vegan Eatery Guide", prompt: "Develop a plant-based dining destination site with culinary inspiration recipe integrations, comprehensive allergen management filters, and bespoke catering consultation portals." },
      { title: "Bar & Lounge Booking", prompt: "Design a vibrant nightlife venue website with extensive cocktail repertoire menus, promotional happy hour timetables, and VIP reservation management systems." },
      { title: "Bakery Order Online", prompt: "Engineer a artisanal bakery e-commerce platform with personalized cake design configurators, scheduled pickup coordination, and premium gift assortment packaging options." },
      { title: "Seafood Restaurant", prompt: "Build a coastal seafood establishment site with live market freshness updates, sustainability certification highlights, and extensive beverage pairing recommendations." },
      { title: "BBQ Joint Reviews", prompt: "Create a Southern-style BBQ restaurant hub with verified customer review aggregations, signature sauce recipe sharing features, and corporate catering proposal inquirers." }
    ]
  },
  {
    name: "Fitness",
    ideas: [
      { title: "Gym Membership Site", prompt: "Develop a state-of-the-art gym facility website with interactive class timetables, multi-tier membership plan comparisons, and immersive virtual facility tour experiences." },
      { title: "Personal Training Booking", prompt: "Design a elite personal training service platform with seamless session reservation calendars, client-specific progress analytics, and integrated nutrition advisory modules." },
      { title: "Yoga Studio Classes", prompt: "Build a serene yoga wellness center site featuring live-streamed class broadcasts, comprehensive pose instructional libraries, and immersive retreat program enrollments." },
      { title: "Home Workout App Landing", prompt: "Craft a motivational home fitness application landing page with engaging workout demonstration videos, structured challenge progression calendars, and achievement milestone badges." },
      { title: "Running Club Community", prompt: "Engineer a dedicated running enthusiast community portal with event coordination calendars, interactive route mapping tools, and exclusive member discussion forums." },
      { title: "CrossFit Box Schedule", prompt: "Develop a high-intensity CrossFit affiliate website with archived workout-of-the-day repositories, certified coach profile directories, and branded merchandise retail sections." },
      { title: "Nutrition Coaching Portal", prompt: "Create a professional nutrition consultancy dashboard with personalized meal planning generators, client health monitoring interfaces, and expansive recipe knowledge repositories." },
      { title: "Dance Studio Enrollment", prompt: "Design a dynamic dance academy site with progressive skill level classifications, performance highlight video galleries, and introductory lesson trial registrations." },
      { title: "Martial Arts Dojo", prompt: "Build a traditional martial arts discipline center website with belt advancement progression charts, specialized seminar scheduling, and essential training gear e-stores." },
      { title: "Wellness Retreat Booking", prompt: "Engineer a holistic wellness retreat reservation platform with premium package configuration options, authentic testimonial integrations, and secure booking processing forms." }
    ]
  },
  {
    name: "Real Estate",
    ideas: [
      { title: "Luxury Home Listings", prompt: "Develop an exclusive luxury residential real estate portal with 360-degree virtual property tours, in-depth neighborhood lifestyle guides, and prioritized inquiry management systems." },
      { title: "Rental Apartment Search", prompt: "Design a user-centric apartment leasing platform with advanced property filtering criteria, expansive photo slideshow integrations, and digitized application submission workflows." },
      { title: "Commercial Property Broker", prompt: "Engineer a commercial real estate brokerage dashboard featuring lease obligation calculators, comprehensive market trend reports, and integrated client relationship management tools." },
      { title: "Vacation Rental Platform", prompt: "Build a premium vacation accommodation marketplace with calendar synchronization APIs, authenticated review aggregation, and instantaneous booking confirmation mechanisms." },
      { title: "New Development Showcase", prompt: "Create a visionary new housing development presentation site with interactive floor plan explorers, transparent pricing disclosure documents, and financing eligibility assessment tools." },
      { title: "Realtor Personal Brand", prompt: "Design a professional realtor branding website with curated sold property portfolios, localized market intelligence insights, and automated contact scheduling functionalities." },
      { title: "Property Valuation Tool", prompt: "Develop an AI-powered real estate valuation engine with algorithmic estimate generators, comparable sales analytics, and professional appraisal report generation capabilities." },
      { title: "Eco-Friendly Homes", prompt: "Engineer a sustainable housing showcase platform with energy performance certification displays, green building standard validations, and developer narrative spotlights." },
      { title: "Investor Portfolio Tracker", prompt: "Build an institutional real estate investment dashboard with projected return-on-investment modelers, holistic portfolio overview summaries, and emerging deal opportunity pipelines." },
      { title: "Historic Home Restoration", prompt: "Create a heritage property restoration specialist site with archival restoration project galleries, historical significance documentation, and preservation funding grant application resources." }
    ]
  },
  {
    name: "Education",
    ideas: [
      { title: "Online Course Platform", prompt: "Develop a full-featured learning management system for digital courses, encompassing high-definition video lecture delivery, adaptive quiz assessment engines, digital certificate issuance, and learner progression analytics." },
      { title: "Tutoring Service Booking", prompt: "Design an intelligent tutoring matchmaking platform with subject expertise alignment algorithms, flexible session timetabling, and integrated secure payment processing gateways." },
      { title: "Language Learning App", prompt: "Engineer an immersive language acquisition application landing with gamified lesson progression structures, interactive proficiency challenges, and global learner community networking features." },
      { title: "University Admissions Page", prompt: "Build a prestigious university recruitment site with exhaustive academic program directories, real-time application status trackers, and engaging virtual campus exploration tours." },
      { title: "Skill Workshop Series", prompt: "Create a professional development workshop series portal with live interactive session hosting, downloadable resource repositories, and post-event attendee networking facilitation tools." },
      { title: "K-12 Homework Help", prompt: "Develop an AI-augmented academic support platform for K-12 students, featuring virtual tutor conversational interfaces, subject-specific content libraries, and parental oversight dashboards." },
      { title: "Professional Certification", prompt: "Design a credentialing authority website with rigorous exam preparation modules, simulated assessment environments, and verifiable digital certificate authentication systems." },
      { title: "Book Club Community", prompt: "Engineer a literary engagement community site with moderated discussion thread architectures, synchronized reading schedule coordinators, and exclusive author virtual meet-and-greet events." },
      { title: "STEM Education Kit Store", prompt: "Build an educational STEM experimentation e-commerce hub with guided experiment instructional manuals, specialized educator resource toolkits, and bulk institutional procurement options." },
      { title: "Career Coaching Portal", prompt: "Create a executive career advancement platform with AI-assisted resume optimization builders, realistic interview simulation scenarios, and algorithmic job opportunity matching engines." }
    ]
  },
  {
    name: "Non-Profit",
    ideas: [
      { title: "Environmental Campaign Site", prompt: "Develop a global environmental advocacy platform with digital petition mobilization tools, strategic donation campaign orchestration, and quantifiable impact metric reporting dashboards." },
      { title: "Animal Shelter Adoption", prompt: "Design a compassionate animal welfare adoption center website with detailed adoptable pet profile databases, streamlined application vetting processes, and volunteer engagement opportunity signups." },
      { title: "Youth Mentorship Program", prompt: "Engineer a youth development mentorship initiative portal with compatibility assessment questionnaires, structured session progress trackers, and inspirational success narrative compilations." },
      { title: "Human Rights Advocacy", prompt: "Build an international human rights watchdog site with timely news dissemination channels, actionable advocacy alert systems, and worldwide chapter organizational directories." },
      { title: "Food Bank Resource Hub", prompt: "Create a community food security resource aggregation platform with eligibility determination evaluators, scheduled distribution event calendars, and donor contribution management interfaces." },
      { title: "Arts Education Outreach", prompt: "Develop an accessible arts education outreach initiative website with competitive grant adjudication applications, cultural event programming calendars, and emerging artist recognition spotlights." },
      { title: "Disaster Relief Coordination", prompt: "Engineer a crisis response coordination hub with rapid needs assessment surveyors, volunteer mobilization orchestration tools, and transparent relief fund allocation trackers." },
      { title: "Mental Health Support", prompt: "Design a comprehensive mental wellness support network site with curated therapeutic resource compendiums, 24/7 crisis hotline integrations, and anonymous peer support discussion forums." },
      { title: "Senior Care Services", prompt: "Build an eldercare service provisioning platform with recreational activity programming schedules, specialized caregiver matching algorithms, and emergency response contact facilitation." },
      { title: "Literacy Program Enrollment", prompt: "Create a foundational literacy advancement program enrollment site with diagnostic reading proficiency evaluations, personalized tutor assignment systems, and measurable progress milestone trackers." }
    ]
  }
]