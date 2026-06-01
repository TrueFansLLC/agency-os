// Creator reference images (identity) for the Threads image pipeline.
// Public Google Drive file IDs → hotlinkable image URLs that fal can fetch.

const FILE_IDS: Record<string, string[]> = {
  Neyla: [
    "1yORPBnEU08JVtyGIBUVQ0kIXx3Ndp2Ng","1qqTGcnSLnI128SDLWF8-rO0SV01IQABN","1DIasdKRBSNBAwGIEgbGhDlTUnEGf7lrF",
    "1v9bpV_3xRNPWLh_MkQ3IFgGpYVBMR8lg","1w2mwiet2Tw9Mrfbs8mW1XxQIIwxlB6LH","1R5xcJp5KeSslvZZsmvhOh7Ta1QzJ80x0",
    "14oXxFD9ynP7_xmp_C6LMTwoTZJRz_0DA","1UoQf1t7ZZkObPNvqZUnaHYPQkPy4YDTL","1Ctoh7_ISgYqndEoyWq21n9OJcNYDEe7c",
    "1S6WZAinCs0r0z56UC4I5IiiU2-gQaoil","1_wOKlcM52bXkrLplJ5eHyxfH3K6ttnBa","1WAlo7UmyZH8HMlVF3CD1g8H-_eLgz7BV",
    "1D5BAo1gb3xNS_g8oRQ4bKdhep2njDjAL","1UY2WPqh0LUEtSigXt4Fgu8YBwtZrdnij",
  ],
  Cathy: [
    "1LIbr2jVEv3kfRoiH4JyJFh_RWtz_EDfK","1iPJU453Ecwm4yNhU11I75p9S-lLTADxw","1mAF8imDzGptI0qQiP8LgyAP80aYnMhmI",
    "1dH7y98obv005GEQSAmn8GDw92o7JuFRC","1dRzwWz_qdrG57cAnZtGcrq0TMSJYtvBh","1LpWrQLLvXkebALGQn-w6_Bl02Z9OFHcU",
    "1HP7VguJaWoSg53aldoNft1zFVGq_G--2","1slC9J1e-JBTlhzBdLeEirLdZo4EoyaYz","1cqxferS5mEj0CopVNydl1XrHZDcMZXtb",
    "152A5wCpHiF6_l36mnoYz42g-6hE0IeU5","1tXsuKpZySgswK1GxJFMkCQjW0Uz73P1l","1YIOCnkViqpdVtGs_882bAezq4hJGtUlI",
  ],
  Romina: [
    "1DJimjBhZPxUT-tZd8685Nfz5HT4-UP04","1Jd60a9CSUJQfhuv4ugwAY5Mx9LwVRSrb","1Q9Nkm2onM6jEsxN9pKezXUhEAg31hBeH",
    "14iH6u_MYYfV2GeWzPr4pTIxapaYtr6G4","1baws-rAOh1FcSQV6SBptqfUc70Cwu-NX","1Fm0vXJQi1Do4BR-Q66kpOaW3XE2l-xCY",
    "1lgB9_1QvY8j0yhu29Uii9DrD8HVPoMwB","1zY7rRlTlKAFxxefOVyaYqf2iuwCN7e-O","1g4j7FGcKpZamCJ8mbpAbgT2C-kCs2Uk0",
    "1kTforobLgEYu6eHvfYSjxnWzSNd4P5qz","1HBjPxBK7jeC0bbD5mGJ2J-yRZwplTJTU","1ZGDwzDlDe7xbXH2FKTERHXxYHFLUcmHk",
    "1jUf2nksf9Fargfqx1tKAxjkqtIfl-bim","1zo398MbGuzWjnZYALHyoabyCbHGNZi0t",
  ],
}

export const CREATORS = Object.keys(FILE_IDS)

export function creatorRefUrls(creator: string): string[] {
  return (FILE_IDS[creator] ?? []).map(id => `https://lh3.googleusercontent.com/d/${id}=w1200`)
}
