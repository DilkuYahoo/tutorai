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
    document.addEventListener("DOMContentLoaded", function () {
        const contactForm = document.getElementById("contactForm");
        const responseMessage = document.getElementById("responseMessage");
    
        if (contactForm) {
            contactForm.addEventListener("submit", function (event) {
                event.preventDefault();
    
                // Get form values
                const email = document.getElementById("email").value;
                const message = document.getElementById("message").value;
    
                // Validate input
                if (!email || !message) {
                    responseMessage.innerHTML = '<p class="text-danger">Please fill in all fields.</p>';
                    return;
                }
    
                // Prepare request payload
            const requestData = {
                sender: "info@advicegenie.com.au",
                recipient: "info@advicegenie.com.au",
                subject: `Contact Form Message from ${email}`, // Include sender's email in the subject
                body: message
            };
    
                // Send request to AWS API Gateway
                fetch("https://n54lm5igkl.execute-api.ap-southeast-2.amazonaws.com/dev/send-email", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(requestData)
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message) {
                        responseMessage.innerHTML = '<p class="text-success">Message sent successfully!</p>';
                        contactForm.reset();
                    } else {
                        responseMessage.innerHTML = '<p class="text-danger">Failed to send message. Please try again later.</p>';
                    }
                })
                .catch(error => {
                    responseMessage.innerHTML = '<p class="text-danger">Error: ' + error.message + '</p>';
                });
            });
        }
    });
    

})(jQuery);