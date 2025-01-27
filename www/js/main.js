(function ($) {
    "use strict";

    // Counter-Up Animation
    document.addEventListener("DOMContentLoaded", function () {
        const counters = document.querySelectorAll(".counter-value");
        const speed = 200; // Animation speed in milliseconds

        counters.forEach((counter) => {
            const target = +counter.getAttribute("data-count");
            const increment = target / speed;

            const updateCount = () => {
                const current = +counter.innerText.replace(/,/g, "");
                if (current < target) {
                    counter.innerText = Math.ceil(current + increment).toLocaleString();
                    setTimeout(updateCount, 1);
                } else {
                    counter.innerText = target.toLocaleString();
                }
            };

            updateCount();
        });
    });

    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();

    // Initiate the wowjs
    new WOW().init();

    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('shadow-sm').css('top', '-100px');
        }
    });

    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({ scrollTop: 0 }, 1500, 'easeInOutExpo');
        return false;
    });

    // Modal Video
    var $videoSrc;
    $('.btn-play').click(function () {
        $videoSrc = $(this).data("src");
    });
    console.log($videoSrc);
    $('#videoModal').on('shown.bs.modal', function (e) {
        $("#video").attr('src', $videoSrc + "?autoplay=1&amp;modestbranding=1&amp;showinfo=0");
    })
    $('#videoModal').on('hide.bs.modal', function (e) {
        $("#video").attr('src', $videoSrc);
    })

    // Project and Testimonial carousel
    $(".project-carousel, .testimonial-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1000,
        margin: 25,
        loop: true,
        center: true,
        dots: false,
        nav: true,
        navText: [
            '<i class="bi bi-chevron-left"></i>',
            '<i class="bi bi-chevron-right"></i>'
        ],
        responsive: {
            0: {
                items: 1
            },
            576: {
                items: 1
            },
            768: {
                items: 2
            },
            992: {
                items: 3
            }
        }
    });

    // Contact Form Submission
    document.getElementById('contactForm')?.addEventListener('submit', function (event) {
        event.preventDefault(); // Prevent default form submission

        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();
        const responseMessage = document.getElementById('responseMessage');

        // Validate email and message
        if (!email || !message) {
            responseMessage.innerHTML = '<div class="alert alert-danger">Please fill out all fields.</div>';
            return;
        }

        // Prepare data for API call
        const data = {
            email: email,
            message: message
        };

        // Make API call to Flask backend
        fetch('https://your-flask-backend-url.com/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    responseMessage.innerHTML = '<div class="alert alert-success">Message sent successfully!</div>';
                    document.getElementById('contactForm').reset(); // Clear the form
                } else {
                    responseMessage.innerHTML = `<div class="alert alert-danger">Error: ${result.message}</div>`;
                }
            })
            .catch(error => {
                responseMessage.innerHTML = '<div class="alert alert-danger">An error occurred. Please try again later.</div>';
                console.error('Error:', error);
            });
    });

})(jQuery);