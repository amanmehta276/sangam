/* =========================================
   SANGAM - App Data (data.js)
   Mock data for all sections
   ========================================= */

const SANGAM_DATA = {

  /* --- Stats --- */
  stats: [
    { label: 'Alumni', value: '12,400+', icon: '🎓' },
    { label: 'Companies', value: '340+', icon: '🏢' },
    { label: 'Success Stories', value: '980+', icon: '⭐' },
    { label: 'Events/Year', value: '60+', icon: '📅' }
  ],

  /* --- Featured Alumni --- */
  featuredAlumni: [
    {
      id: 1,
      name: 'Priya Sharma',
      batch: '2018',
      branch: 'CSE',
      company: 'Google',
      role: 'Senior SWE',
      avatar: null,
      initials: 'PS',
      color: '#6c63ff'
    },
    {
      id: 2,
      name: 'Arjun Mehta',
      batch: '2016',
      branch: 'ECE',
      company: 'ISRO',
      role: 'Scientist-B',
      avatar: null,
      initials: 'AM',
      color: '#f72585'
    },
    {
      id: 3,
      name: 'Sneha Patel',
      batch: '2019',
      branch: 'ME',
      company: 'Tesla',
      role: 'Design Engineer',
      avatar: null,
      initials: 'SP',
      color: '#4cc9f0'
    },
    {
      id: 4,
      name: 'Rohan Gupta',
      batch: '2017',
      branch: 'IT',
      company: 'Microsoft',
      role: 'PM',
      avatar: null,
      initials: 'RG',
      color: '#f77f00'
    }
  ],

  /* --- Announcements --- */
  announcements: [
    {
      id: 1,
      title: 'Annual Alumni Meet 2025',
      date: 'March 15, 2025',
      body: 'Join us for our grand annual alumni gathering at the college campus. Register by Feb 28.',
      tag: 'Event',
      tagColor: '#6c63ff'
    },
    {
      id: 2,
      title: 'Placement Drive – TCS & Infosys',
      date: 'February 10, 2025',
      body: 'TCS & Infosys campus recruitment for final year students. Eligibility: 6.5+ CGPA.',
      tag: 'Placement',
      tagColor: '#4cc9f0'
    },
    {
      id: 3,
      title: 'Alumni Scholarship Applications Open',
      date: 'January 20, 2025',
      body: 'Applications are open for the Alumni-funded merit scholarships. Last date: Feb 15.',
      tag: 'Scholarship',
      tagColor: '#f72585'
    },
    {
      id: 4,
      title: 'Tech Talk: AI in Healthcare',
      date: 'January 5, 2025',
      body: 'Dr. Meera Singh (Batch 2010) will conduct a tech talk on AI applications in healthcare.',
      tag: 'Webinar',
      tagColor: '#f77f00'
    }
  ],

  /* --- Activity Feed Posts --- */
  posts: [
    {
      id: 1,
      user: 'Aarav Joshi',
      role: 'Student',
      batch: '2024',
      branch: 'CSE',
      initials: 'AJ',
      color: '#6c63ff',
      type: 'project',
      typeLabel: 'Student Project',
      content: '🚀 Just completed my final year project on Real-time Sign Language Detection using MediaPipe + TensorFlow. Achieved 94% accuracy! Looking for alumni mentors to guide me towards publication. #AI #ML #FinalYear',
      likes: 87,
      comments: 14,
      time: '2h ago',
      liked: false
    },
    {
      id: 2,
      user: 'Priya Sharma',
      role: 'Alumni',
      batch: '2018',
      branch: 'CSE',
      initials: 'PS',
      color: '#f72585',
      type: 'work',
      typeLabel: 'Work Update',
      content: '🎉 Thrilled to share that I\'ve joined Google as a Senior Software Engineer! Grateful to my professors and batchmates. For students – feel free to DM me for referrals & guidance. Let\'s keep Sangam alive! 💙 #Google #Alumni #Placement',
      likes: 342,
      comments: 67,
      time: '5h ago',
      liked: true
    },
    {
      id: 3,
      user: 'Vikram Nair',
      role: 'Alumni',
      batch: '2015',
      branch: 'ME',
      initials: 'VN',
      color: '#4cc9f0',
      type: 'fundraiser',
      typeLabel: 'Fundraising',
      content: '❤️ Calling all alumni! Let\'s contribute to the new College Library Fund. Even ₹500 helps. We\'ve raised ₹2.4L so far — goal is ₹5L. Your contribution stays forever. Link in comments. 📚 #GiveBack #AlumniLove',
      likes: 156,
      comments: 38,
      time: '1d ago',
      liked: false
    },
    {
      id: 4,
      user: 'Divya Reddy',
      role: 'Student',
      batch: '2025',
      branch: 'ECE',
      initials: 'DR',
      color: '#f77f00',
      type: 'project',
      typeLabel: 'Student Project',
      content: '⚡ Built a solar-powered IoT water quality monitor for rural villages as part of our social impact project. Presented at the State Innovation Fair and won 2nd prize! Super proud of our team 🙌 #IoT #SocialImpact #ECE',
      likes: 124,
      comments: 22,
      time: '2d ago',
      liked: false
    },
    {
      id: 5,
      user: 'Sneha Patel',
      role: 'Alumni',
      batch: '2019',
      branch: 'ME',
      initials: 'SP',
      color: '#7b2d8b',
      type: 'work',
      typeLabel: 'Work Update',
      content: '🚗 Our team at Tesla just filed a patent for a new thermal management system for EV batteries. 3 years of research paying off. Dream big, freshers – anything is possible from this campus! 💪 #Tesla #Engineering #Innovation',
      likes: 289,
      comments: 44,
      time: '3d ago',
      liked: false
    }
  ],

  /* --- Chat Conversations --- */
  chats: [
    {
      id: 1,
      name: 'Priya Sharma',
      initials: 'PS',
      color: '#6c63ff',
      lastMessage: 'Sure! Send me your resume, I\'ll review it 👍',
      time: '10:32 AM',
      unread: 2,
      online: true
    },
    {
      id: 2,
      name: 'Arjun Mehta',
      initials: 'AM',
      color: '#f72585',
      lastMessage: 'The GATE prep resources I shared should help.',
      time: 'Yesterday',
      unread: 0,
      online: false
    },
    {
      id: 3,
      name: 'Alumni Cell - CSE',
      initials: 'AC',
      color: '#4cc9f0',
      lastMessage: 'Placement drive is on Feb 15. Prepare well!',
      time: 'Mon',
      unread: 5,
      online: true,
      isGroup: true
    },
    {
      id: 4,
      name: 'Rohan Gupta',
      initials: 'RG',
      color: '#f77f00',
      lastMessage: 'Great project! Let\'s connect on LinkedIn.',
      time: 'Sun',
      unread: 0,
      online: false
    },
    {
      id: 5,
      name: 'Sneha Patel',
      initials: 'SP',
      color: '#7b2d8b',
      lastMessage: 'Happy to mentor your capstone project 🙂',
      time: 'Fri',
      unread: 1,
      online: true
    },
    {
      id: 6,
      name: 'Placement Committee',
      initials: 'PC',
      color: '#06d6a0',
      lastMessage: 'Results for mock interviews will be out tonight.',
      time: 'Thu',
      unread: 0,
      online: false,
      isGroup: true
    }
  ],

  /* --- What We Do sections --- */
  whatWeDo: [
    { icon: '🤝', title: 'Mentorship', desc: 'Alumni guide students in academics, careers and personal growth through 1-on-1 sessions.' },
    { icon: '💼', title: 'Placements', desc: 'Alumni refer students to top companies and conduct mock interviews and resume reviews.' },
    { icon: '🎉', title: 'Events', desc: 'Annual meets, tech talks, workshops, sports and cultural events across the year.' },
    { icon: '💰', title: 'Scholarships', desc: 'Merit and need-based scholarships funded by successful alumni for deserving students.' }
  ],

  /* --- Current user profile --- */
  currentUser: {
    name: 'Rahul Verma',
    branch: 'Computer Science & Engineering',
    year: '3rd Year (2022–2026)',
    role: 'Student',
    batch: '2026',
    initials: 'RV',
    color: '#6c63ff',
    bio: 'Passionate about full-stack development and AI. Looking for internship opportunities.',
    skills: ['React', 'Node.js', 'Python', 'Machine Learning', 'MongoDB', 'Git', 'Docker', 'Figma'],
    connections: 128,
    posts: 7,
    followers: 45
  }
};