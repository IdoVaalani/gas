import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2 } from "lucide-react";

export default function AddressAutocomplete({ value, onChange, placeholder, required }) {
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inputValue.length >= 2) {
        fetchAddresses(inputValue);
      } else {
        setSuggestions([]);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  const fetchAddresses = async (query) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&` +
        `countrycodes=il&` +
        `format=json&` +
        `addressdetails=1&` +
        `accept-language=he&` +
        `limit=10`,
        {
          headers: {
            'User-Agent': 'AspireGas/1.0',
            'Accept-Language': 'he'
          }
        }
      );
      
      const data = await response.json();
      
      const formattedSuggestions = data
        .filter(item => item.address)
        .map(item => {
          const addr = item.address;
          let displayAddress = '';
          let city = '';
          
          // קביעת שם העיר
          city = addr.city || addr.town || addr.village || addr.municipality || '';
          
          // בניית כתובת עם רחוב ומספר בית
          if (addr.road || addr.pedestrian) {
            const street = addr.road || addr.pedestrian;
            displayAddress = street;
            
            if (addr.house_number) {
              displayAddress += ' ' + addr.house_number;
            }
            
            if (city) {
              displayAddress += ', ' + city;
            }
          } else if (addr.suburb || addr.neighbourhood) {
            // אם אין רחוב, הצג שכונה
            displayAddress = addr.suburb || addr.neighbourhood;
            if (city) {
              displayAddress += ', ' + city;
            }
          } else if (city) {
            // אם יש רק עיר
            displayAddress = city;
          }
          
          // אם יש תרגום עברי בשם, השתמש בו
          let hebrewName = item.display_name;
          if (displayAddress) {
            hebrewName = displayAddress;
          }
          
          return {
            display: displayAddress || item.display_name,
            full: item.display_name,
            lat: item.lat,
            lon: item.lon,
            city: city
          };
        })
        .filter(item => item.display);

      setSuggestions(formattedSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleSelectSuggestion = (suggestion) => {
    setInputValue(suggestion.display);
    onChange(suggestion.display);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleBlur = () => {
    // עיכוב קטן כדי לאפשר לחיצה על הצעה
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          onBlur={handleBlur}
          placeholder={placeholder ?? ""}
          required={required}
          className="pr-10"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          ) : (
            <MapPin className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto shadow-lg">
          <div className="py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-right hover:bg-blue-50 transition-colors border-b last:border-b-0 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-right">
                  <div className="font-medium text-gray-900">{suggestion.display}</div>
                  {suggestion.city && (
                    <div className="text-xs text-gray-500 mt-0.5">{suggestion.city}, ישראל</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {showSuggestions && inputValue.length >= 2 && suggestions.length === 0 && !isLoading && (
        <Card className="absolute z-50 w-full mt-1 shadow-lg">
          <div className="px-4 py-3 text-gray-500 text-sm text-center">
            לא נמצאו כתובות מתאימות
          </div>
        </Card>
      )}
    </div>
  );
}