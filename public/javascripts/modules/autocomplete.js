function autocomplete(input, latInput, lngInput) {
    if (!input) return;
    const dropdown = new google.maps.places.Autocomplete(input);

    dropdown.addListener('place_changed', () => {
        const place = dropdown.getPlace();
        latInput.value = place.geometry.location.lat();
        lngInput.value = place.geometry.location.lng();
    });
    //If someone hits enter on the address field, don't summit the form
    input.on('keydawon', (e) => {
        if(e.keycode === 13) e.preventDefault();
    });
}

export default autocomplete;