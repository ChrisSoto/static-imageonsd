import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import MarkdownIt from 'markdown-it';
import { documentToHtmlString } from '@contentful/rich-text-html-renderer';
import { BLOCKS } from '@contentful/rich-text-types';
import CleanCSS from 'clean-css';
import dotenv from "dotenv";
import contentful from "contentful";
import getW3CDate from "./helper.js";

dotenv.config({ path: "./.env" });

const client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE_ID,
  accessToken: process.env.CONTENTFUL_ACCESS_KEY,
});

function getHeroImagesFromModifierData(dataArr, service) {
  let heroImageData = {};
  for (let i = 0; i < dataArr.length; i++) {

    const data = dataArr[i];

    // first set it from services
    // this serves as a default
    if ("desktop" in data.fields) {
      heroImageData.desktop = data.fields.desktop;
    }

    if ("mobile" in data.fields) {
      heroImageData.mobile = data.fields.mobile;
    }

    // if there is service specific data for the city
    if ("service" in data.fields) {

      if (data.fields.service.fields.name === service) {

        if ("desktop" in data.fields.section.fields) {
          heroImageData.desktop = data.fields.section.fields.desktop;
        }

        if ("mobile" in data.fields.section.fields) {
          heroImageData.mobile = data.fields.section.fields.mobile;
        }
      }
    }
  }

  return heroImageData;
}

// just testing git

function getGallerySectionFromModifierData(dataArr, service) {
  let gallerySectionData;
  for (let i = 0; i < dataArr.length; i++) {
    const data = dataArr[i];
    if ("images" in data.fields) {
      gallerySectionData = data;      
    }
    if ("service" in data.fields) {
      if (data.fields.service.fields.name === service) {
        gallerySectionData = data.fields.section;
      }
    }
  }
  return gallerySectionData;
}

function getCopySectionFromModifierData(dataArr, service) {
  let copySectionData;
  for (let i = 0; i < dataArr.length; i++) {
    const data = dataArr[i];
    if ("text" in data.fields) {
      copySectionData = data;
    }
    if ("service" in data.fields) {
      if (data.fields.service.fields.name === service) {
        copySectionData = data.fields.section;
      }
    }
  }
  return copySectionData;
}

function buildCityService(city, oService) {
  // have to make a copy because we are modifying the object reference
  const service = JSON.parse(JSON.stringify(oService));

  let cityService = {
    city: city.fields.name,
    cityMap: city.fields.googleMap,
  };

  // I pass the home page for city only pages
  // so I need to check for the service specific fields
  if ("name" in service.fields) {
    cityService.service = service.fields.name;
  }

  if ("slug" in service.fields) {
    cityService.serviceSlug = service.fields.slug;
  }

  // normal stuff starts here
  if ("metaTitle" in service.fields) {
    cityService.metaTitle = service.fields.metaTitle;
  }

  if ("metaDescription" in service.fields) {
    cityService.metaDescription = service.fields.metaDescription;
  }

  if ("heroSection" in service.fields) {
    cityService.heroSection = service.fields.heroSection;

    // need to replace hero images if they're specified in the city and service
    if ("heroImages" in city.fields && city.fields.heroImages.length > 0) {

      let imageData = getHeroImagesFromModifierData(city.fields.heroImages, service.fields.name);

      // override hero images
      if ('desktop' in imageData) {
        cityService.heroSection.fields.images.fields.desktop = imageData.desktop;
      }

      if ('mobile' in imageData) {
        cityService.heroSection.fields.images.fields.mobile = imageData.mobile;
      }
    }
  }

  if ("gallerySection" in service.fields) {
    cityService.gallerySection = service.fields.gallerySection;
  }

  if ("copySection" in service.fields) {
    cityService.copySection = service.fields.copySection;
  }

  if ("faqSection" in service.fields) {
    cityService.faqSection = service.fields.faqSection;
  }
  
  //
  //
  // city overrides
  //
  //
  if ("metaTitle" in city.fields) {
    cityService.metaTitle = city.fields.metaTitle;
  }

  if ("metaDescription" in city.fields) {
    cityService.metaDescription = city.fields.metaDescription;
  }

  // these section have cityServiceModifiers that override depending on the service
  if ("gallerySection" in city.fields) {
    const galleryData = getGallerySectionFromModifierData(city.fields.gallerySection, service.fields.name);
    cityService.gallerySection = galleryData;
  }

  if ("copySection" in city.fields) {
    const copyData = getCopySectionFromModifierData(city.fields.copySection, service.fields.name);
    cityService.copySection = copyData;
  }
  
  if ("faqSection" in city.fields) {
    cityService.faqSection = city.fields.faqSection;
  }

  // chech for [[service]] in metatitle and description
  // this extra flexibility is needed because John likes
  // to change all the titles and descriptions

  cityService = replaceServiceForMeta(cityService, service.fields.name);
  cityService = findSectionsToReplaceCityName(cityService, city.fields.name);

  return cityService;
}

function findSectionsToReplaceCityName(data, city) {
  // chech for metaData
  if ("metaTitle" in data) {
    data.metaTitle = replaceCityName(data.metaTitle, city);
  }
  if ("metaDescription" in data) {
    data.metaDescription = replaceCityName(data.metaDescription, city);
  }

  // if it's a list recursively check
  if (data.length > 0) {
    for (let i = 0; i < data.length; i++) {
      data[i].fields = findSectionsToReplaceCityName(data[i].fields, city);
    }
  }

  if ("heroSection" in data) {
    if ("h1" in data.heroSection.fields) {
      data.heroSection.fields.h1 = replaceCityName(data.heroSection.fields.h1, city);
    }
    if ("subHeading" in data.heroSection.fields) {
      data.heroSection.fields.subHeading = replaceCityName(data.heroSection.fields.subHeading, city);
    }
    if ("text" in data.heroSection.fields) {
      data.heroSection.fields.text = replaceCityName(data.heroSection.fields.text, city);
    }
  }

  if ("faqSection" in data) {
    if ("title" in data.faqSection.fields) {
      data.faqSection.fields.title = replaceCityName(data.faqSection.fields.title, city);
    }
    if ("intro" in data.faqSection.fields) {
      data.faqSection.fields.intro = replaceCityName(data.faqSection.fields.intro, city);
    }
    if ("questions" in data.faqSection.fields) {
      for (let i = 0; i < data.faqSection.fields.questions.length; i++) {
        data.faqSection.fields.questions[i].fields.question = replaceCityName(data.faqSection.fields.questions[i].fields.question, city);
        data.faqSection.fields.questions[i].fields.faqAnswer = replaceCityName(data.faqSection.fields.questions[i].fields.faqAnswer, city);
      }
    }
    if ("outro" in data.faqSection.fields) {
      data.faqSection.fields.outro = replaceCityName(data.faqSection.fields.outro, city);
    }
  }

  return data;
}

function replaceServiceForMeta(data, serviceName) {
  if ("metaTitle" in data) {
    data.metaTitle = replaceServiceName(data.metaTitle, serviceName);
  }
  if ("metaDescription" in data) {
    data.metaDescription = replaceServiceName(data.metaDescription, serviceName);
  }

  return data;
}

function replaceCityName(string, cityName) {
  return string.replace(/\[\[city\]\]/g, cityName);
}

function replaceServiceName(string, serviceName) {
  return string.replace(/\[\[service\]\]/g, serviceName);
}

function loadData(eleventyConfig) {
  eleventyConfig.addGlobalData("home", () => {
    return client.getEntries({ 'include': 2, 'sys.id': process.env.HOME_ID }).then((home) => {
      const data = findSectionsToReplaceCityName(home.items[0].fields, "San Diego");
      return data;
    });
  });

  eleventyConfig.addGlobalData("services", () => {
    return client.getEntries({ 'include': 3, 'sys.id': process.env.SERVICES_LIST_ID }).then((services) => {
      const data = findSectionsToReplaceCityName(services.items[0].fields.pages, "San Diego");
      return data;
    });
  });

  eleventyConfig.addGlobalData("cityServices", () => {
    return client.getEntries({ 'include': 3, 'sys.id': process.env.SERVICES_LIST_ID }).then((services) => {
      return client.getEntries({ 'include': 3, 'sys.id': process.env.CITIES_LIST_ID }).then((cities) => {
        let cityServices = [];

        for (const service of services.items[0].fields.pages) {
          for (const city of cities.items[0].fields.pages) {
            cityServices.push(buildCityService(city, service));
          }
        }

        return cityServices;
      });
    });
  });

  eleventyConfig.addGlobalData("cities", () => {
    return client.getEntries({ 'include': 2, 'sys.id': process.env.HOME_ID }).then((home) => {

      // I change the name of the home page because usually the service name is something like "T-Shirts" or "Embroidery"
      // in the case of the home page it is descriptive, "Image On Home Page" so it needs to be changed
      home.items[0].fields.name = "Custom T-Shirts Printing and Embroidery";

      return client.getEntries({ 'include': 3, 'sys.id': process.env.CITIES_LIST_ID }).then((cities) => {
        let cityData = [];

        for (const city of cities.items[0].fields.pages) {
          cityData.push(buildCityService(city, home.items[0]));
        }

        return cityData;
      });
    });
  });

  eleventyConfig.addGlobalData("blog", () => {
    return client.getEntries({ 'include': 3, 'sys.id': process.env.BLOG_LIST_ID }).then((blog) => {
      return blog.items[0].fields.pages;
    });
  });

  eleventyConfig.addGlobalData("seoPages", () => {
    return client.getEntries({ 'include': 3, 'sys.id': process.env.SEO_LIST_ID }).then((page) => {
      return page.items[0].fields.pages;
    });
  });
}

function richTextOptions() {
  return {
    renderNode: {
      [BLOCKS.EMBEDDED_ASSET]: (node) => {
        const alt = node.data.target.fields.title;
        const url = node.data.target.fields.file.url;
        return `<img class="mb-8 mt-4" src="https:${url}" alt="${alt}">`;
      },
    },
  };
}

export default function (eleventyConfig) {

  loadData(eleventyConfig);

  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);

  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    extensions: "html",
    formats: ["webp"],
    defaultAttributes: {
      loading: "lazy",
      decoding: "async",
    },
  });

  eleventyConfig.addFilter("md", (string) => {
    return MarkdownIt().render(string);
  });

  eleventyConfig.addFilter("richText", (data) => {
    return documentToHtmlString(data, richTextOptions());
  });

  eleventyConfig.addFilter("w3c", (date) => {
    return getW3CDate(date);
  });

  eleventyConfig.addFilter("strip", (post) => {
    let content = post.replace(/(<([^>]+)>)/gi, "");
    return content;
  });

  eleventyConfig.addPassthroughCopy({
    "global.out.css": "/css/global.css",
  });

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
  })

  eleventyConfig.addPassthroughCopy({ "src/favicon": "/" });
  eleventyConfig.addPassthroughCopy("src/.htaccess");

  eleventyConfig.addFilter("cssmin", function (code) {
    return new CleanCSS({}).minify(code).styles;
  });
}

export const config = {
  dir: {
    includes: "../_includes",
    data: "../_data",
    input: "src",
    output: "dist"
  }
};