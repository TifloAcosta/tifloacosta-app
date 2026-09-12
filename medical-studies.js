(() => {
  'use strict';

  const resources = window.TIFLO_RESOURCES;
  if (!Array.isArray(resources)) return;

  const medicalCategoryById = new Map([
    ['es-1fpa1se6481mR9SFmwZ3RGtO0_IEoXA3n', 'Estudios médicos'],
    ['en-1J8ZCK1w_N-isRJuPmIqJVI9S1qOg4puc', 'Medical Studies']
  ]);

  resources.forEach(resource => {
    const category = medicalCategoryById.get(resource.id);
    if (category) resource.category = category;
  });

  const additions = [
    {
      id: 'es-estudio-medico-calor-2026',
      lang: 'es',
      category: 'Estudios médicos',
      title: 'Cuando el termómetro se pone chulo',
      url: 'https://drive.google.com/file/d/1_VyVgtFln1tSznf9ct3990CGZ_i4wOO1/view?usp=drivesdk',
      openUrl: 'https://drive.google.com/file/d/1_VyVgtFln1tSznf9ct3990CGZ_i4wOO1/view?usp=drivesdk',
      new: true
    },
    {
      id: 'en-medical-study-heat-2026',
      lang: 'en',
      category: 'Medical Studies',
      title: 'When the Thermometer Gets Cocky',
      url: 'https://drive.google.com/file/d/1yEGRwTEzGjgEzmYtP2wnlnaACFFbdho6/view?usp=drivesdk',
      openUrl: 'https://drive.google.com/file/d/1yEGRwTEzGjgEzmYtP2wnlnaACFFbdho6/view?usp=drivesdk',
      new: true
    }
  ];

  additions.forEach(resource => {
    if (!resources.some(item => item.id === resource.id)) resources.push(resource);
  });

  const englishRssIds = new Set([
    'en-124egW5QOiuKENPZ-nIUPxN-3WpQQ98LW',
    'en-1vcdA-RuOzb-908X42S1fkfpLGy6KBpPY'
  ]);

  resources.forEach(resource => {
    if (englishRssIds.has(resource.id)) resource.category = 'RSS and Feeds';
  });

  const spanishRssResources = [
    ['es-rss-introduccion-2026', 'RSS, la forma más tranquila de enterarte de todo', '10TKIY5ZkO75bFVRgrqpv77UeeaZm04iG'],
    ['es-rss-coleccion-general-2026', 'Colección de fuentes RSS en español', '1lNvxuYJe5jlARv6Bv9JRf2eQZLJw1oOb'],
    ['es-rss-argentina-2026', 'Colección de fuentes RSS para Argentina', '1BKeMGcbFNwcEo1vCn2a3RHChEZ-E6DUp'],
    ['es-rss-bolivia-2026', 'Colección de fuentes RSS para Bolivia', '1jZ9gxtlHFlDtXNAio4q0b08RSounaR2i'],
    ['es-rss-brasil-2026', 'Colección de fuentes RSS para Brasil', '1iedADwzeg4b-HR5eETdj3xgPYVcZJFJo'],
    ['es-rss-chile-2026', 'Colección de fuentes RSS para Chile', '1CobDrAd5F8o1i9g_KFrQhSOTTp_tvxyP'],
    ['es-rss-colombia-2026', 'Colección de fuentes RSS para Colombia', '1xVb-ANKjekZBG28m612b8Z8oesjeu1Oc'],
    ['es-rss-costa-rica-2026', 'Colección de fuentes RSS para Costa Rica', '1hWndtfF0y7Q2lEkM5MHlePY3IUVt4nVR'],
    ['es-rss-cuba-2026', 'Colección de fuentes RSS para Cuba', '16j8ap-YOHo9SZwbEO9eEtQQHQ1vZh0JM'],
    ['es-rss-ecuador-2026', 'Colección de fuentes RSS para Ecuador', '18Qs2VycdAwhZ1EACzOGvTnFTn_N0U_2L'],
    ['es-rss-el-salvador-2026', 'Colección de fuentes RSS para El Salvador', '1ZUVV7HeLvrRXtLgr4neU4uLtKyimqkM-'],
    ['es-rss-espana-2026', 'Colección de fuentes RSS para España', '1-0-rT0Kfkqpbv06gMeXL0Y1PzsEWdIEY'],
    ['es-rss-estados-unidos-2026', 'Colección de fuentes RSS para Estados Unidos en español', '1VgndGHz1ky0krT9zj-wGoXEHSXrf_t2f'],
    ['es-rss-guatemala-2026', 'Colección de fuentes RSS para Guatemala', '1shAfKN8xnFASB_cWKN1Uz5qipDaq7Umd'],
    ['es-rss-honduras-2026', 'Colección de fuentes RSS para Honduras', '157YiErU2qiThVfCIsUoNKNaiDwD6Eogm'],
    ['es-rss-mexico-2026', 'Colección de fuentes RSS para México', '1Gn4fEdAQe03tU-8f8kXmGjy6KRYNslDS'],
    ['es-rss-nicaragua-2026', 'Colección de fuentes RSS para Nicaragua', '1cKP2rOJzgQwbxsYr3Vmb_b41DfjiBKEq'],
    ['es-rss-panama-2026', 'Colección de fuentes RSS para Panamá', '1AIcUU1XfmNljqJgpiSdg8rDk5d52y1hg'],
    ['es-rss-paraguay-2026', 'Colección de fuentes RSS para Paraguay', '1wy_FCdXDPB1S-5A4ckJ3IcLm9EBPETWL'],
    ['es-rss-peru-2026', 'Colección de fuentes RSS para Perú', '14XdQvI1K2vSVg5dlokfr-NyiN2gdOwq1'],
    ['es-rss-republica-dominicana-2026', 'Colección de fuentes RSS para República Dominicana', '1v6caQ9oXiFLFPtW7de6e57Q4Vg9PgFbt'],
    ['es-rss-uruguay-2026', 'Colección de fuentes RSS para Uruguay', '1Xpljcl9XLUFE9cLo595D13LbED5ZK249'],
    ['es-rss-venezuela-2026', 'Colección de fuentes RSS para Venezuela', '1Dqgjgjx33j5KkLAlmp4_pNvxB4XbgwWV']
  ].map(([id, title, driveId]) => ({
    id,
    lang: 'es',
    category: 'RSS y fuentes',
    title,
    url: `https://drive.google.com/file/d/${driveId}/view?usp=drivesdk`,
    openUrl: `https://drive.google.com/file/d/${driveId}/view?usp=drivesdk`,
    new: false
  }));

  spanishRssResources.forEach(resource => {
    if (!resources.some(item => item.id === resource.id)) resources.push(resource);
  });
})();
