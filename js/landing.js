/* ========================================
   LANDING.JS - Effects & Interactivity
   ======================================== */

document.addEventListener("DOMContentLoaded", () => {
    const bgContainer = document.querySelector('.landing-body');
    const orbs = document.querySelectorAll('.landing-bg__orb');
    const grid = document.querySelector('.landing-bg__grid');

    // Interactive Parallax Effect on Mouse Move
    document.addEventListener("mousemove", (e) => {
        const xAxis = (window.innerWidth / 2 - e.pageX) / 25;
        const yAxis = (window.innerHeight / 2 - e.pageY) / 25;

        // Move the Grid slightly opposite to mouse
        if(grid) {
            grid.style.transform = `rotateX(60deg) translateY(-100px) translate(${xAxis}px, ${yAxis}px)`;
        }

        // Move Orbs with different depths
        orbs.forEach((orb, index) => {
            const depth = (index + 1) * 1.5; // deeper elements move more
            orb.style.transform = `translate(${xAxis * depth}px, ${yAxis * depth}px) scale(${1 + (yAxis/200)})`;
        });
    });

    // Smooth Scroll to sections
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if(target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
