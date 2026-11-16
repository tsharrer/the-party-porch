// Shared by the website and the booking Apps Script project's Pricing.gs.
function partyPorchPromoPrice_(selection, code, now) {
  if (typeof code !== "string" || code.trim().toUpperCase() !== "NERFTHANKS10") {
    throw new Error("That discount code is not valid.");
  }
  if (!Number.isFinite(now) || now >= Date.parse("2027-01-01T06:00:00Z")) {
    throw new Error("NERFTHANKS10 expired. Bookings had to be submitted by December 31, 2026, Houston time.");
  }
  var catalog = {
    nerf: [180, "Nerf Battles"], movie: [375, "Movie Night"], popcorn: [69, "Snack Bar"],
    cottoncandy: [79, "Cotton Candy"], shavedice: [79, "Shaved Ice"],
    photobooth: [375, "Photo Booth"], flower: [225, "Flower Backdrop"],
    water: [225, "Water Battles"], yardgames: [89, "Yard Games"],
    softplay: [295, "Soft Play"], bounce: [255, "White Bounce House"]
  };
  var main = {
    "Nerf Battles": "nerf", "Snack Bar": "", "Photo Booth": "photobooth",
    "Flower Backdrop": "flower", "Water Battles": "water", "Yard Games": "yardgames",
    "Soft Play": "softplay", "White Bounce Houses": "bounce", "Movie Night": "movie"
  };
  var extras = {
    "We set up": 40, "Extra referee hour": 40,
    "Popcorn supplies - up to 45 servings": 20,
    "Cotton candy supplies - up to 45 servings": 20,
    "Shaved ice syrups - up to 45 servings": 20
  };
  if (!selection || typeof selection !== "object" || typeof selection.rental !== "string" ||
      !Object.prototype.hasOwnProperty.call(main, selection.rental)) {
    throw new Error("This discount requires a priced rental. Contact us for a discounted custom quote.");
  }
  function list(value) {
    if (!Array.isArray(value) || value.length > 20 ||
        value.some(function(item) { return typeof item !== "string"; }) ||
        value.some(function(item, index) { return value.indexOf(item) !== index; })) {
      throw new Error("Review your rental selections before applying the discount.");
    }
    return value;
  }
  var cart = list(selection.cart), addons = list(selection.addons);
  var rental = 0, excluded = 0, keys = {};
  var players = "", service = "-";
  var base = main[selection.rental];
  if (base === "nerf") {
    var rentals = {"12": 180, "18": 250, "24": 320};
    var referees = {"12": 100, "18": 100, "24": 200};
    if (typeof selection.players !== "string" || !Object.prototype.hasOwnProperty.call(rentals, selection.players)) {
      throw new Error("For 25+ players, contact us for a discounted custom quote.");
    }
    if (selection.service !== "rental" && selection.service !== "referee") {
      throw new Error("Choose a valid Nerf service level.");
    }
    players = "Up to " + selection.players;
    service = selection.service === "referee" ? "Rental + Referee" : "Rental only";
    rental += rentals[selection.players];
    if (selection.service === "referee") excluded += referees[selection.players];
  } else if (base) {
    rental += catalog[base][0];
  }
  if (base) keys[base] = true;
  cart.forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(catalog, key)) throw new Error("Unknown cart item.");
    rental += catalog[key][0]; keys[key] = true;
  });
  addons.forEach(function(label) {
    if (Object.prototype.hasOwnProperty.call(extras, label)) {
      excluded += extras[label];
    } else {
      var key = Object.keys(catalog).filter(function(k) { return catalog[k][1] === label; })[0];
      if (!key) throw new Error("Unknown add-on.");
      rental += catalog[key][0]; keys[key] = true;
    }
  });
  [
    ["Popcorn supplies - up to 45 servings", "Snack Bar"],
    ["Cotton candy supplies - up to 45 servings", "Cotton Candy"],
    ["Shaved ice syrups - up to 45 servings", "Shaved Ice"]
  ].forEach(function(pair) {
    if (addons.indexOf(pair[0]) !== -1 && addons.indexOf(pair[1]) === -1) {
      throw new Error("Supply packs require their matching machine selection.");
    }
  });
  if (!rental) throw new Error("Choose at least one rental before using the discount.");
  var rentalCents = rental * 100;
  var discountCents = Math.round(rentalCents * 0.1);
  return {
    code: "NERFTHANKS10", version: "nerfthanks10-v1",
    rentalCents: rentalCents, excludedCents: excluded * 100,
    discountCents: discountCents, totalCents: rentalCents + excluded * 100 - discountCents,
    items: Object.keys(keys), players: players || "-", service: service,
    cart: cart.map(function(k) { return catalog[k][1]; }).join(", ") || "None"
  };
}
