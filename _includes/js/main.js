function setupStickyForm() {
  const $header = $('.sticky-header');
  const $contactFormWrapper = $('.contact-form-wrapper');
  const $seoPageContent = $('.seo-page-content')

  // get screen width
  let screenWidth = $(window).outerWidth();

  if (screenWidth < 767 || $contactFormWrapper.length === 0 || $seoPageContent.length === 0) {
    return false;
  }

  console.log('has a contact form wrapper');

  const $contactForm = $('.contact-form');
  const $footer = $('footer');

  let headerHeight = $header.outerHeight();
  let formOriginalTop = $contactFormWrapper.offset().top;
  let footerTop = $footer.offset().top;

  return {
    header: $header,
    contactFormWrapper: $contactFormWrapper,
    contactForm: $contactForm,
    footer: $footer,
    headerHeight: headerHeight,
    formOriginalTop: formOriginalTop,
    footerTop: footerTop
  };
}

function updateStickyForm(data) {
  let scrollTop = $(window).scrollTop();
  let formHeight = data.contactForm.outerHeight();
  let bannerHeight = $('#banner').outerHeight();
  let seoPageHeight = $('.seo-page-content').outerHeight();

  // Update headerHeight and footerTop on scroll, as they might change on responsive layouts
  headerHeight = data.header.outerHeight();
  footerTop = data.footer.offset().top;

  if (scrollTop + headerHeight > data.formOriginalTop) {
    // Make the form sticky
    data.contactFormWrapper.addClass('sticky').css({
      position: 'fixed',
      top: data.headerHeight + 35,
      width: data.contactFormWrapper.width()
    });

    const formStop = seoPageHeight + bannerHeight - 35;
    const diff = scrollTop + formHeight - formStop;
    let formStopPosition = headerHeight + 35 - diff;

    if (scrollTop + formHeight > formStop) {
      data.contactFormWrapper.addClass('sticky').css({
        position: 'fixed',
        top: formStopPosition,
        width: data.contactFormWrapper.width()
      });
    }
  } else {
    // Return the form to its original position
    data.contactFormWrapper.removeClass('sticky').css({
      position: 'static',
      top: 'auto',
      bottom: 'auto',
      width: 'auto'
    });
  }
}

function setupAccordion() {
  const accordion = $('.accordion');
  if (accordion) {
    $('.accordion-panel').slideUp();
    $('.accordion-panel:first').slideDown();
    $('.accordion-title:first').toggleClass('active');
    $('.accordion-panel:first').toggleClass('active');
    $('.accordion-title').on('click', function () {
      $('.accordion-panel').filter($(this).next()).toggleClass('active');
      $(this).toggleClass('active');
      $(this).next().slideToggle();
    });
  }
}

function setupShadowBox() {
  const shadowBox = $('#shadow-box');

  if (!shadowBox) {
    return;
  }

  $('.thumbnail').click(function () {
    let imgSrc = $(this).attr('id');
    imgSrc = "https:" + imgSrc +"?w=800&h=800";
    $('#shadowbox-image').attr('src', imgSrc);
    $('#shadowbox').fadeIn();
  });

  $('#shadowbox').click(function () {
    $('#shadowbox-image').attr('src', "/assets/temp.webp");
    $(this).fadeOut();
  });
}


// contact form
function sendForm(event) {
  const form = $('#contact-form');
  const formAction = document.getElementById('contact-form');
  const formData = form.serializeArray();

  let data = getData(formData);

  let url = formAction.action;
  data = JSON.stringify(data);
  // let url = 'http://127.0.0.1:5001/imageonsd-af038/us-central1/addContact';

  fetch(url, {
    method: 'POST',
    body: data,
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(response => response.json())
    .then(data => {
      formSuccess = true;
      clearForm();
      alert('Thank you for your interest. We will be in touch shortly.');
    })
    .catch(err => alert(err));
}
// $('#contact-submit').on('click', sendForm);
function submitForm(event) {
  event.preventDefault();
  if (inputValid('#full-name') && inputValid('#e-mail') && inputValid('#project-details')) {
    sendForm(event);
  } else {
    alert('Please check your form for errors.');
  }
}

function clearForm() {
  $('#contact-form').trigger('reset');
}

function getData(data) {
  let name = data[0].value;
  let email = data[1].value;
  let phone = data[2].value;
  let details = data[3].value;

  if (!name) {
    name = localStorage.getItem('full-name');
  }
  if (!email) {
    email = localStorage.getItem('e-mail');
  }
  if (!phone) {
    phone = localStorage.getItem('phone-number');
  }
  if (!details) {
    details = localStorage.getItem('project-details');
  }

  return {
    name,
    email,
    phone,
    details
  };
}

function inputValid(id) {
  const prop = $(id);
  if (prop.length == 0) {
    return false
  }
  return prop[0].validity.valid;
}

function writeToLocalStorage(id) {
  var edValue = document.getElementById(id);
  var value = edValue.value;
  localStorage.setItem(id, value)
}

window.onload = function () {
  setupShadowBox();
  setupAccordion();

  const stickyForm = setupStickyForm();

  if (stickyForm) {
    updateStickyForm(stickyForm);
    $(window).on('scroll resize', () => {
      updateStickyForm(stickyForm)
    });
  }

  $('#contact-submit').on('click', submitForm);
}

