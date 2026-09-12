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
    if (!resources.some(item => item.id === resource.id)) {
      resources.push(resource);
    }
  });
})();
