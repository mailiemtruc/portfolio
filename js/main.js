import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Giữ nguyên các code khởi tạo Lenis ở dưới...

// ======================================================
// 1. SMOOTH SCROLL (LENIS) - FIX CRASH IOS
// ======================================================
let lenis = null;
try {
    if (typeof Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            direction: 'vertical',
            smooth: true,
            mouseMultiplier: 0.8,
            smoothTouch: false, 
            touchMultiplier: 2,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);
    }
} catch (e) {
    console.warn("Lenis init skipped (Mobile safe):", e);
}

// === [MỚI] KIỂM TRA THIẾT BỊ ===
function isMobileOrTablet() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  // Android, iOS, Windows Phone
  if (/android|ipad|iphone|ipod|windows phone/i.test(userAgent)) {
    return true;
  }
  // Các thiết bị Android/Tablet khác (có thể loại trừ desktop mode)
  if (/Mobi|Tablet|Mobile|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk|PSP/i.test(userAgent)) {
    return true;
  }
  // Dùng màn hình cảm ứng như một tiêu chí phụ (ít chính xác hơn)
  if (window.matchMedia("(pointer: coarse)").matches) {
    return true;
  }
  return false;
}

// ======================================================
// BIẾN TOÀN CỤC ĐỂ QUẢN LÝ ANIMATION (QUAN TRỌNG)
// ======================================================
// Biến này sẽ chứa hàm khởi động 3D, mặc định là null
let startBackgroundEffects = null; 

// ======================================================
// 2. PRELOADER SYSTEM (Đã bọc an toàn trong hàm)
// ======================================================
// KIỂM TRA TRẠNG THÁI TẢI TRANG (FIX CHO MODULE)
if (document.readyState === 'loading') {
    // Nếu trang đang tải, thì chờ
    document.addEventListener("DOMContentLoaded", initPreloader);
} else {
    // Nếu trang đã tải xong (do module load chậm), CHẠY LUÔN
    initPreloader();
}

function initPreloader() {
    // 1. Khai báo biến BÊN TRONG hàm (An toàn nhất)
    const preloader = document.querySelector(".preloader");
    const counter = document.querySelector(".counter");
    const barFill = document.querySelector(".bar-fill");
    const video = document.getElementById("intro-video");

    const IS_MOBILE = isMobileOrTablet(); 

    // Hàm kết thúc loading
    function finishPreloader() {
        if (video) video.pause();
        if (preloader) preloader.classList.add("hide");

        requestAnimationFrame(() => {
            document.querySelectorAll(".reveal-content").forEach(el => el.classList.add("active"));
        });

        setTimeout(() => {
            if (typeof startBackgroundEffects === 'function') startBackgroundEffects();
            if (typeof initScrollReveal === 'function') initScrollReveal();
            if (!IS_MOBILE) followCursor(); 
        }, 800); 
    }

    // === LOGIC XỬ LÝ (CHẠY TRONG HÀM) ===
    if (IS_MOBILE) {
        // --- MOBILE: ẨN VIDEO & CHẠY GIẢ LẬP ---
        if (video) {
            video.style.display = 'none'; // Chỉ ẩn, không xóa
            video.pause();
        }
        
        if (preloader) preloader.classList.add('mobile-only');

        // Luôn chạy loading giả định để đảm bảo vào được web
        let loadProgress = 0;
        const loadInterval = setInterval(() => {
            loadProgress += 5; // Tốc độ load
            
            // Kiểm tra biến tồn tại trước khi gán
            if (counter) counter.textContent = Math.min(100, loadProgress) + "%";
            if (barFill) barFill.style.width = Math.min(100, loadProgress) + "%";
            
            if (loadProgress >= 100) {
                clearInterval(loadInterval);
                setTimeout(finishPreloader, 200);
            }
        }, 60); 

    } else {
        // --- PC: CÓ VIDEO ---
        if (video) {
            const playPromise = video.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => finishPreloader()); // Nếu lỗi play, vào web luôn
            }
        
            video.addEventListener("timeupdate", () => {
                if (video.duration) {
                    const percent = Math.round((video.currentTime / video.duration) * 100);
                    if (counter) counter.textContent = percent + "%";
                    if (barFill) barFill.style.width = percent + "%";
                }
            });
        
            video.addEventListener("ended", () => {
                if (counter) counter.textContent = "100%";
                if (barFill) barFill.style.width = "100%";
                setTimeout(finishPreloader, 100);
            });
        } else {
            finishPreloader();
        }
    }
}
// ======================================================
// 3. THREE.JS BACKGROUND (ĐÃ SỬA: RÕ HƠN, SÁNG HƠN, NHIỀU HẠT HƠN)
// ======================================================
const canvas = document.querySelector("#bg-canvas");
if (canvas) {
    const scene = new THREE.Scene();

    // Giữ màu nền tối, nhưng sẽ thêm ánh sáng mạnh hơn
    scene.background = new THREE.Color(0x020408); 

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Tạo hệ thống hạt (Particles)
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 3000; // TĂNG RẤT NHIỀU (từ 1500 lên 3000)
    const posArray = new Float32Array(particlesCount * 3);

    for(let i = 0; i < particlesCount * 3; i++) {
        // Giữ nguyên phạm vi rải hạt
        posArray[i] = (Math.random() - 0.5) * 50; 
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // === [ĐÃ SỬA] CHỈNH THÔNG SỐ HẠT ===
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.03, // TĂNG KÍCH THƯỚC HẠT (từ 0.015 lên 0.03) để rõ ràng hơn
        color: 0xffffff, // MÀU TRẮNG TINH
        transparent: true,
        opacity: 1.0, // TĂNG LÊN 1.0 (Không mờ) để hạt RÕ NHẤT
        blending: THREE.AdditiveBlending, // Giữ nguyên hiệu ứng phát sáng lấp lánh
        sizeAttenuation: true 
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // === [ĐÃ SỬA] TĂNG CƯỜNG ĐỘ ÁNH SÁNG NỀN ===
    // Ánh sáng nền (giúp làm sáng tổng thể hơn)
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0); // TĂNG CƯỜNG ĐỘ LÊN 1.0 (từ 0.5)
    scene.add(ambientLight);
    
    // Đèn chính (tăng cường độ)
    const pointLight = new THREE.PointLight(0x0080ff, 5, 50); // TĂNG CƯỜNG ĐỘ ĐÈN XANH LÊN 5 (từ 1.5)
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    camera.position.z = 5;

    let mouseX = 0;
    let mouseY = 0;

    // --- QUAN TRỌNG: Đóng gói animation vào hàm ---
    const animateThree = () => {
        requestAnimationFrame(animateThree); // Vòng lặp

        // Animation hạt (Giữ nguyên tốc độ xoay)
        particlesMesh.rotation.y += 0.0008;
        particlesMesh.rotation.x += 0.0003;
        
        // Tương tác chuột nhẹ hơn
        particlesMesh.rotation.y += 0.0008 + (mouseX * 0.00005);
        particlesMesh.rotation.x += 0.0008 + (mouseY * 0.00005);

        renderer.render(scene, camera);
    };

    // --- QUAN TRỌNG: Gán hàm vào biến toàn cục để Preloader gọi sau ---
    startBackgroundEffects = animateThree; 

    // Resize window
    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener("mousemove", (event) => {
        mouseX = event.clientX - window.innerWidth / 2;
        mouseY = event.clientY - window.innerHeight / 2;
    });
}

// ======================================================
// 4. STARFALL CURSOR EFFECT (Đã bỏ Glow)
// ======================================================
const particleContainer = document.getElementById('particle-container'); 
let mouseX = 0;
let mouseY = 0;
let lastTime = 0;
let particleCount = 0; 

// Hàm tạo và thả hạt
function createStarParticle(x, y) {
    // Không cần dùng cursorGlow nữa, chỉ cần particleContainer
    if (!particleContainer || particleCount > 150) return; 

    const star = document.createElement('div');
    star.className = 'particle-star';
    
    // Tạo vị trí ngẫu nhiên xung quanh con trỏ (phạm vi 20px)
    const offsetX = (Math.random() - 0.5) * 20; 
    const offsetY = (Math.random() - 0.5) * 20; 
    
    star.style.left = `${x + offsetX}px`;
    star.style.top = `${y + offsetY}px`;
    
    // Kích thước ngẫu nhiên (1px đến 3px)
    const size = Math.random() * 2 + 1; 
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    
    particleContainer.appendChild(star);
    particleCount++;

    // Xóa hạt sau khi animation hoàn tất (0.8s) để giải phóng bộ nhớ DOM
    setTimeout(() => {
        star.remove();
        particleCount--;
    }, 1200); 
}

// Hàm chính quản lý hiệu ứng chuột (Không cần logic di chuyển mượt mà cho Glow nữa)
function followCursor(time) {
    requestAnimationFrame(followCursor);

    // 1. Bỏ logic cập nhật vị trí Glow

    // 2. Tạo hạt (giới hạn tốc độ)
    if (time - lastTime > 40) { // Tạo một hạt mới mỗi 40ms (25 hạt/giây)
        createStarParticle(mouseX, mouseY);
        lastTime = time;
    }
}

// Cập nhật vị trí chuột thực tế
document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

// ======================================================
// 5. 3D TILT EFFECT (Thẻ nghiêng)
// ======================================================
if (typeof VanillaTilt !== 'undefined') {
    // VanillaTilt tự động init nếu tìm thấy class, hoặc ta init thủ công khi render
    // Phần này thường được gọi trong các hàm render
}


// ======================================================
// 6. SCROLL REVEAL (Cuộn hiện)
// ======================================================
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
}


// ======================================================
// 7. EMAILJS - Xử lý Form liên hệ
// ======================================================
const contactForm = document.getElementById("contact-form");
// Lưu ý: Code này sẽ được kích hoạt lại bên trong hàm renderContact
// Nhưng ta vẫn giữ logic ở đây phòng trường hợp form tĩnh

// ======================================================
// 8. MOBILE MENU TOGGLE
// ======================================================
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.querySelector(".nav-links");

if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
        navLinks.classList.toggle("active");
        const icon = menuBtn.querySelector("i");
        if (navLinks.classList.contains("active")) {
            icon.classList.remove("ri-menu-4-line");
            icon.classList.add("ri-close-line");
        } else {
            icon.classList.remove("ri-close-line");
            icon.classList.add("ri-menu-4-line");
        }
    });

    // Đóng menu khi click link (Logic này sẽ được chạy lại trong renderNav)
    document.querySelectorAll(".nav-links a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
            const icon = menuBtn.querySelector("i");
            icon.classList.remove("ri-close-line");
            icon.classList.add("ri-menu-4-line");
        });
    });
}

// ======================================================
// 9. QUẢN LÝ DỮ LIỆU VÀ NGÔN NGỮ (RENDER DATA)
// ======================================================

// --- A. BIẾN TOÀN CỤC LƯU DATA ---
let projectsData = [];
let experienceData = [];
let skillsData = [];
let aboutData = null;
let navData = null;
let heroData = null;
let contactData = null;
let currentLang = localStorage.getItem('lang') || 'en';
let translations = {};

// Cấu hình mới: Ít nghiêng hơn, tắt hiệu ứng lóa (glare), tắt con quay hồi chuyển mobile
const tiltSettings = { 
    max: 10,             // Giảm độ nghiêng từ 25 xuống 10 (đỡ chóng mặt, đỡ lag)
    speed: 400,          // Tốc độ nghiêng
    glare: false,        // TẮT hiệu ứng bóng lóa (Rất nặng)
    "max-glare": 0,
    gyroscope: false,    // Tắt cảm biến xoay trên điện thoại (tiết kiệm pin)
    scale: 1.02          // Phóng to nhẹ thôi
};

// --- B. CÁC HÀM RENDER ---

// 1. Hàm vẽ Projects
function renderProjects(lang) {
    const container = document.getElementById("projects-container");
    if (!container || !projectsData || !projectsData.list) return;

    const info = projectsData.info;
    const headingEl = document.getElementById("proj-heading");
    if (headingEl && info) {
        headingEl.innerText = info.title[lang] || info.title['vi'];
    }

    const createTags = (tags) => tags.map(tag => `<span style="color:${tag.color}">${tag.name}</span>`).join('');
    const createLinks = (links) => (links.github ? `<a href="${links.github}"><i class="ri-github-fill"></i></a>` : '') + (links.demo ? `<a href="${links.demo}"><i class="ri-external-link-line"></i></a>` : '');

    let htmlContent = "";
    projectsData.list.forEach(project => {
        const title = project.title[lang] || project.title['vi'];
        let rawDesc = project.description[lang] || project.description['vi'];
        const description = Array.isArray(rawDesc) ? rawDesc.join('<br>') : rawDesc;
        const imageClass = project.specialClass ? `project-image ${project.specialClass}` : `project-image`;

        htmlContent += `
          <article class="project-card tilt-card" data-tilt>
            <div class="${imageClass}">
              <img src="${project.image}" alt="${title}">
              <div class="project-links">${createLinks(project.links || {})}</div>
            </div>
            <div class="project-content">
              <h3>${title}</h3>
              <p>${description}</p>
              <div class="project-tags">${createTags(project.tags || [])}</div>
            </div>
          </article>
        `;
    });

    container.innerHTML = htmlContent;
    // Kích hoạt Tilt ngay sau khi vẽ xong HTML
    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll(".tilt-card"), tiltSettings);
}

// 2. Hàm vẽ Experience
function renderExperience(lang) {
    const container = document.getElementById("experience-container");
    if (!container || !experienceData || !experienceData.list) return;

    const info = experienceData.info;
    const headingEl = document.getElementById("exp-heading");
    if (headingEl && info) {
        headingEl.innerText = info.title[lang] || info.title['vi'];
    }

    let htmlContent = "";
    experienceData.list.forEach((exp, index) => {
        const sideClass = index % 2 === 0 ? 'left-item' : 'right-item';
        const role = exp.role[lang] || exp.role['vi'];
        const descArray = exp.description[lang] || exp.description['vi'] || [];
        const listItems = descArray.map(item => `<li>${item}</li>`).join('');

        htmlContent += `
            <div class="timeline-item ${sideClass} fade-in-up">
                <div class="timeline-dot" style="--dot-color: ${exp.color};"><i class="${exp.icon}"></i></div>
                <div class="timeline-date">${exp.period}</div>
                <div class="timeline-content tilt-card" data-tilt>
                    <h3>${role}</h3>
                    <h4>${exp.company}</h4>
                    <ul>${listItems}</ul>
                </div>
            </div>
        `;
    });

    container.innerHTML = htmlContent;
    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll("#experience .tilt-card"), tiltSettings);
    if (typeof initScrollReveal === 'function') initScrollReveal();
}

// 3. Hàm vẽ Skills
function renderSkills(lang) {
    const container = document.getElementById("skills-container");
    if (!container || !skillsData || !skillsData.list) return;

    const info = skillsData.info;
    const headingEl = document.getElementById("skill-heading");
    if (headingEl && info) {
        headingEl.innerText = info.title[lang] || info.title['vi'];
    }

    let htmlContent = "";
    skillsData.list.forEach(category => {
        let itemsHtml = category.items.map(item => {
            let iconHtml = item.type === "image" 
                ? `<img src="${item.src}" alt="${item.name}" class="${item.imgClass || ''}">`
                : `<i class="${item.iconClass}" style="font-size: 35px; color: #fff;"></i>`;
            
            return `
                <div class="tech-card tilt-card" data-tilt style="--glow-color: ${item.color};">
                    ${iconHtml}<span>${item.name}</span>
                </div>`;
        }).join('');

        htmlContent += `
            <div class="skill-category fade-in-up">
                <h3>${category.category}</h3>
                <div class="skill-grid">${itemsHtml}</div>
            </div>`;
    });
    container.innerHTML = htmlContent;
    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll("#skills .tilt-card"), tiltSettings);
    if (typeof initScrollReveal === 'function') initScrollReveal();
}

// 4. Hàm vẽ About
function renderAbout(lang) {
    const container = document.getElementById("about-container");
    if (!container || !aboutData) return;

    const intro = aboutData.intro;
    const subTitle = intro.subTitle[lang] || intro.subTitle['vi'];
    const heading = intro.heading[lang] || intro.heading['vi'];
    const text = intro.description[lang] || intro.description['vi'];

    const introHtml = `
        <div class="intro-header fade-in-up visible">
            <span class="sub-title">${subTitle}</span>
            <div class="section-title fade-in-up visible">
                <h2 class="overview-heading">${heading}</h2>
            </div>
            <p class="overview-text">${text}</p>
        </div>
    `;

    let rolesHtml = "";
    aboutData.roles.forEach(role => {
        const roleTitle = role.title[lang] || role.title['vi'];
        rolesHtml += `
            <div class="role-card tilt-card" data-tilt>
              <div class="card-gradient"></div>
              <div class="card-content">
                <img src="${role.image}" alt="Role Icon">
                <h3>${roleTitle}</h3>
              </div>
            </div>
        `;
    });

    container.innerHTML = `${introHtml}<div class="roles-grid">${rolesHtml}</div>`;
    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll("#about .tilt-card"), tiltSettings);
}

// 5. Hàm vẽ Hero
function renderHero(lang) {
    const container = document.getElementById("hero-container");
    if (!container || !heroData) return;

    const info = heroData.info;
    const code = heroData.codeSnippet;
    const badge = info.badge[lang] || info.badge['vi'];
    const title = info.title[lang] || info.title['vi'];
    const tagline = info.tagline[lang] || info.tagline['vi'];
    const btnProject = info.buttons.projects[lang] || info.buttons.projects['vi'];
    const btnContact = info.buttons.contact[lang] || info.buttons.contact['vi'];

    const formatArray = (arr) => `[ ` + arr.map(item => `<span class="s">"${item}"</span>`).join(', ') + ` ]`;

    const htmlContent = `
        <div class="hero-text-content fade-in-up visible">
          <div class="badge">${badge}</div>
          <h1 class="glitch-text" data-text="${info.name}">${info.name}</h1>
          <h2 class="gradient-text">${title}</h2>
          <p>${tagline}</p>
          <div class="cta-group">
            <a href="#projects" class="btn btn-primary"><span>${btnProject}</span> <i class="ri-arrow-right-up-line"></i></a>
            <a href="#contact" class="btn btn-secondary">${btnContact}</a>
          </div>
          <div class="social-links">
            <a href="${info.social.github}" target="_blank"><i class="ri-github-fill"></i></a>
            <a href="${info.social.facebook}" target="_blank"><i class="ri-facebook-fill"></i></a>
          </div>
        </div>
        
        <div class="hero-visual tilt-card" data-tilt>
          <img src="${info.avatar}" class="floating-avatar" alt="Me">
          <div class="glass-panel">
            <div class="card-header">
              <div class="traffic-lights"><span></span><span></span><span></span></div>
              <div class="code-tag">${code.filename}</div>
            </div>
            <div class="code-content">
              <pre>
<span class="k">const</span> <span class="v">expert</span> = {
  <span class="p">name</span>: <span class="s">"${code.name}"</span>,
  <span class="p">role</span>: <span class="s">"${code.role}"</span>,
  <span class="p">focus</span>: ${formatArray(code.focus)},
  <span class="p">priorities</span>: ${formatArray(code.priorities)},
  <span class="p">stack</span>: [
    ${code.stack.map(s => `<span class="s">"${s}"</span>`).join(',\n    ')}
  ],
  <span class="f">mission</span>: <span class="k">function</span>() {
    <span class="k">return</span> <span class="s">"${code.mission}"</span>;
  }
};
</pre>
            </div>
          </div>
        </div>
    `;

    container.innerHTML = htmlContent;
    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll("#hero-container .tilt-card"), tiltSettings);
}

// 6. Hàm vẽ Navbar
function renderNav(lang) {
    if (!navData) return;
    const logoContainer = document.getElementById("nav-logo-container");
    if (logoContainer) {
        logoContainer.innerHTML = `<img src="${navData.logo.src}" alt="${navData.logo.alt}">`;
        logoContainer.href = navData.logo.link;
    }
    const linksContainer = document.getElementById("nav-links-container");
    if (linksContainer) {
        let linksHtml = "";
        navData.menu.forEach(item => {
            const label = item.label[lang] || item.label['vi'];
            linksHtml += `<li><a href="${item.link}" class="nav-item"><i class="${item.icon}"></i><span>${label}</span></a></li>`;
        });
        linksContainer.innerHTML = linksHtml;
    }
    // Gán lại sự kiện đóng menu mobile
    const navLinks = document.querySelector(".nav-links");
    const menuBtn = document.getElementById("menuBtn");
    if (navLinks && menuBtn) {
        document.querySelectorAll(".nav-links a").forEach(link => {
            link.addEventListener("click", () => {
                navLinks.classList.remove("active");
                const icon = menuBtn.querySelector("i");
                if(icon) { icon.classList.remove("ri-close-line"); icon.classList.add("ri-menu-4-line"); }
            });
        });
    }
}

// 7. Render Contact
function renderContact(lang) {
    const container = document.getElementById("contact-container");
    if (!container || !contactData) return;
    const t = contactData;
    const title = t.title[lang] || t.title['vi'];
    const f = t.form;
    const phName = f.namePlaceholder[lang] || f.namePlaceholder['vi'];
    const phEmail = f.emailPlaceholder[lang] || f.emailPlaceholder['vi'];
    const phMsg = f.messagePlaceholder[lang] || f.messagePlaceholder['vi'];
    const btnText = f.button[lang] || f.button['vi'];

    // Cấu trúc HTML mới: .contact-wrapper bao quanh
    container.innerHTML = `
        <div class="section-title fade-in-up visible"><h2>${title}</h2></div>
        
        <div class="contact-wrapper fade-in-up visible">
            <div class="contact-box glass-panel tilt-card" data-tilt>
              <form class="contact-form" id="contact-form">
                <div class="form-group"><input type="text" name="name" placeholder="${phName}" required></div>
                <div class="form-group"><input type="email" name="email" placeholder="${phEmail}" required></div>
                <div class="form-group"><textarea name="message" rows="4" placeholder="${phMsg}" required></textarea></div>
                <button type="submit" class="btn btn-primary big-btn"><i class="ri-send-plane-fill"></i> ${btnText}</button>
              </form>
            </div>

            <div id="contact-model-canvas" class="contact-model-container"></div>
        </div>
    `;

    if (typeof VanillaTilt !== 'undefined') VanillaTilt.init(document.querySelectorAll("#contact .tilt-card"), tiltSettings);

    // Gọi hàm load 3D sau khi HTML đã được render
    setTimeout(() => {
        initContact3DModel();
    }, 100);

    // Gán lại sự kiện EmailJS
    const contactForm = document.getElementById("contact-form");
    if (contactForm) {
        contactForm.addEventListener("submit", function(e) {
            e.preventDefault();
            const submitBtn = contactForm.querySelector("button");
            const originalBtnContent = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Sending...';
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.7";

            const serviceID = "service_968g1e7";
            const templateID = "template_l0txu0a";

            emailjs.sendForm(serviceID, templateID, this)
                .then(() => {
                    submitBtn.innerHTML = '<i class="ri-check-line"></i> Sent Successfully!';
                    submitBtn.style.background = "#27c93f";
                    contactForm.reset();
                    setTimeout(() => {
                        submitBtn.innerHTML = originalBtnContent;
                        submitBtn.style.background = "";
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = "1";
                    }, 4000);
                }, (err) => {
                    submitBtn.innerHTML = '<i class="ri-error-warning-line"></i> Failed!';
                    submitBtn.style.background = "#ff5f56";
                    alert("Lỗi: " + JSON.stringify(err));
                    setTimeout(() => {
                        submitBtn.innerHTML = originalBtnContent;
                        submitBtn.style.background = "";
                        submitBtn.disabled = false;
                        submitBtn.style.opacity = "1";
                    }, 3000);
                });
        });
    }
}

// --- NEW: Hàm Load 3D Model Logo ---
function initContact3DModel() {
    const container = document.getElementById('contact-model-canvas');
    if (!container) return;

    // 1. Setup Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 5; 

    // 2. Setup Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Trong suốt
    
    container.innerHTML = ''; 
    container.appendChild(renderer.domElement);

    // 3. Controls 
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false; 
    controls.autoRotate = true;
    controls.autoRotateSpeed = 3;

    // 4. Lighting (Đánh đèn để tôn màu xanh)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Giảm sáng nền chút để tạo độ sâu
    scene.add(ambientLight);

    // Đèn chính (Trắng) chiếu tạo khối
    const mainLight = new THREE.DirectionalLight(0xffffff, 3); 
    mainLight.position.set(5, 5, 10);
    scene.add(mainLight);

    // Đèn phụ (Tím/Xanh) chiếu từ dưới lên để tạo hiệu ứng Cyber
    const rimLight = new THREE.DirectionalLight(0x0040ff, 5); 
    rimLight.position.set(-5, -5, 5);
    scene.add(rimLight);

    // 5. Load & Paint Model
    const loader = new GLTFLoader();
    loader.load(
        'img/models/mlt_logo.glb', 
        (gltf) => {
            const model = gltf.scene;

            // --- [QUAN TRỌNG] SƠN MÀU XANH ---
            model.traverse((child) => {
                if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0x0040ff,      
                        metalness: 0.8,       
                        roughness: 0.2,       
                        emissive: 0x001a66,   
                        emissiveIntensity: 0.2
                    });
                }
            });

            // --- CHỈNH ĐỘ TO TẠI ĐÂY ---
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size); 
            const maxDim = Math.max(size.x, size.y, size.z);

            // CŨ: const scaleFactor = 3 / maxDim;  <-- Số 3 làm model bị bé
            // MỚI: Tăng lên 6.5 để to đùng (bạn có thể chỉnh số này tùy ý: 5, 6, 7...)
            const targetSize = 4; 
            const scaleFactor = targetSize / maxDim; 
            
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Căn giữa
            const centeredBox = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            centeredBox.getCenter(center);
            model.position.sub(center); 

            scene.add(model);
        },
        undefined,
        (err) => console.error(err)
    );

    // 6. Loop
    const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    // 7. Resize
    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// --- C. CHỨC NĂNG DỊCH THUẬT ---
function translate(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) el.innerHTML = translations[lang][key];
    });

    localStorage.setItem('lang', lang);
    updateToggleText(lang);
    currentLang = lang;

    renderProjects(lang);
    renderExperience(lang);
    renderAbout(lang);
    renderHero(lang);
    renderNav(lang);
    renderContact(lang);
    renderSkills(lang);
}

function updateToggleText(lang) {
    const toggleBtn = document.getElementById('lang-toggle');
    if (toggleBtn) {
        if (lang === 'vi') {
            toggleBtn.textContent = 'VI'; 
            toggleBtn.setAttribute('data-lang', 'en'); 
        } else {
            toggleBtn.textContent = 'EN';
            toggleBtn.setAttribute('data-lang', 'vi'); 
        }
    }
}

// --- D. INIT ---
document.addEventListener("DOMContentLoaded", () => {
    translate(currentLang);

    // Fetch tuần tự hoặc song song
    Promise.all([
        fetch('json/project.json').then(res => res.json()).then(data => projectsData = data),
        fetch('json/experience.json').then(res => res.json()).then(data => experienceData = data),
        fetch('json/skills.json').then(res => res.json()).then(data => skillsData = data),
        fetch('json/about.json').then(res => res.json()).then(data => aboutData = data),
        fetch('json/hero.json').then(res => res.json()).then(data => heroData = data),
        fetch('json/navbar.json').then(res => res.json()).then(data => navData = data),
        fetch('json/contact.json').then(res => res.json()).then(data => contactData = data)
    ]).then(() => {
        // Render tất cả sau khi có dữ liệu
        renderProjects(currentLang);
        renderExperience(currentLang);
        renderSkills(currentLang);
        renderAbout(currentLang);
        renderHero(currentLang);
        renderNav(currentLang);
        renderContact(currentLang);
    }).catch(err => console.error('Error loading JSON:', err));
});

const toggleBtnHandler = document.getElementById('lang-toggle');
if (toggleBtnHandler) {
    toggleBtnHandler.addEventListener('click', (e) => {
        const nextLang = e.target.getAttribute('data-lang');
        translate(nextLang);
    });
}